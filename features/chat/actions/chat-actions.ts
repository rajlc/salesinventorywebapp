'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import axios from 'axios'

export interface ChatSettings {
    store_id: string
    messaging_enabled: boolean
    ai_enabled: boolean
    auto_reply_on_new_order: boolean
    new_order_template: string
    new_order_delay_minutes: number
    ai_provider: string
    openai_api_key: string | null
    openai_model: string
    app_url?: string
    created_at?: string
    updated_at?: string
}

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

// Sign Daraz API Requests helper
function signRequest(apiName: string, params: Record<string, unknown>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + String(params[key])
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// Parse message text summary (resolves JSON cards to human-readable text)
function parseSummary(content: string | null): string | null {
    if (!content) return null;
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
            // Follow store invitation — cardType 10010 OR action key OR contains sellerId (follow card)
            if (parsed.cardType === 10010 || parsed.cardType === '10010' ||
                parsed.action === 'followCard_follow' || parsed.sellerId) {
                return 'Follow Invitation';
            }
            if (parsed.cardType === 10007 || parsed.cardType === '10007' || parsed.orderId || parsed.order_id) {
                return 'Order Card';
            }
            if (parsed.cardType === 10006 || parsed.cardType === '10006' || parsed.itemId || parsed.item_id) {
                return 'Product Card';
            }
            if (parsed.cardType === 10008 || parsed.cardType === '10008' || parsed.promotionId || parsed.promotion_id) {
                return 'Voucher Card';
            }
            // Template 10015: welcome message with nested txt JSON
            if (parsed.txt) {
                const txtVal = parsed.txt;
                try {
                    const inner = JSON.parse(txtVal);
                    return inner.en || inner.ne || txtVal;
                } catch {
                    return typeof txtVal === 'string' ? txtVal.substring(0, 80) : content;
                }
            }
            return parsed.content || content;
        }
    } catch {
        // Not JSON
    }
    return content;
}

// 1. Get Store Tokens & App Config — with auto-refresh for the Chat app
async function getStoreTokenAndSecret(storeId: string) {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_CHAT_APP_SECRET?.trim()

    if (!appKey || !appSecret) {
        throw new Error('Daraz Chat API keys configuration missing on server env')
    }

    const supabase = await createAdminClient()
    const { data: tokenData, error } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'chat')
        .maybeSingle()

    if (error || !tokenData) {
        throw new Error(`No active chat connection or token found for store: ${storeId}. Please connect your Daraz account for Chat.`)
    }

    // Auto-refresh: check if token is near expiry (within 2 days)
    const updatedAt = new Date(tokenData.updated_at).getTime()
    const expiresIn = tokenData.expires_in || 1296000 // default 15 days
    const expiryTime = updatedAt + expiresIn * 1000
    const twoDays = 2 * 24 * 60 * 60 * 1000
    const isNearExpiry = Date.now() > (expiryTime - twoDays)

    if (isNearExpiry && tokenData.refresh_token) {
        try {
            console.log(`[ChatToken] Token near expiry for store ${storeId}, attempting refresh...`)
            const refreshParams: Record<string, unknown> = {
                app_key: appKey,
                refresh_token: tokenData.refresh_token,
                timestamp: Date.now().toString(),
                sign_method: 'sha256',
            }
            const apiPath = '/auth/token/refresh'
            // Sign the refresh request using CHAT app secret
            const keys = Object.keys(refreshParams).sort()
            let str = apiPath
            keys.forEach(k => { str += k + String(refreshParams[k]) })
            refreshParams.sign = crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()

            const refreshResponse = await axios.post(`${API_URL}${apiPath}`, null, { params: refreshParams, timeout: 10000 })
            const refreshData = refreshResponse.data

            if (refreshData.access_token) {
                await supabase
                    .from('daraz_api_tokens')
                    .update({
                        access_token: refreshData.access_token,
                        refresh_token: refreshData.refresh_token || tokenData.refresh_token,
                        expires_in: refreshData.expires_in || expiresIn,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('store_id', storeId)
                    .eq('app_type', 'chat')

                console.log(`[ChatToken] Token refreshed successfully for store ${storeId}`)
                return { appKey, appSecret, accessToken: refreshData.access_token }
            } else {
                console.warn(`[ChatToken] Refresh response missing access_token for store ${storeId}:`, refreshData)
            }
        } catch (refreshErr) {
            const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
            console.error(`[ChatToken] Token refresh failed for store ${storeId}:`, msg)
            // Fall through and try the existing token anyway
        }
    } else if (isNearExpiry && !tokenData.refresh_token) {
        console.warn(`[ChatToken] Token near expiry but no refresh_token stored for store ${storeId}. Please reconnect the Chat account.`)
    }

    return { appKey, appSecret, accessToken: tokenData.access_token }
}

// 2. Fetch/Sync Sessions from Daraz API
export async function syncDarazChatSessions(storeId: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        // Verify if store messaging is enabled
        const settings = await getChatSettings(storeId)
        if (!settings.messaging_enabled) {
            console.log(`[ChatSync] Messaging is disabled for store: ${storeId}. Skipping sync.`)
            return { success: false, reason: 'Disconnected' }
        }

        const timestamp = Date.now().toString()
        // Fetch sessions updated in the last 7 days
        const sevenDaysAgo = (Date.now() - 7 * 24 * 60 * 60 * 1000).toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            start_time: sevenDaysAgo,
            page_size: '50'
        }

        const apiPath = '/im/session/list'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ChatSync] Syncing sessions for store ${storeId}...`)
        const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        const sessionList = response.data.data?.session_list || []
        console.log(`[ChatSync] Retrieved ${sessionList.length} sessions from Daraz.`)

        for (const session of sessionList) {
            // Self-heal buyer ID from session ID if undefined
            let buyerId = String(session.buyer_id || '');
            if (!buyerId || buyerId === 'undefined') {
                const parts = String(session.session_id || '').split('_');
                if (parts.length >= 4) {
                    if (parts[1] === '1') buyerId = parts[0];
                    else if (parts[3] === '1') buyerId = parts[2];
                }
            }

            // Resolve buyer's real name from order history if title is generic
            let sessionTitle = session.title || '';
            const isGenericTitle = !sessionTitle || sessionTitle === 'undefined' || sessionTitle === 'Buyer undefined' || sessionTitle.startsWith('Buyer ');
            
            if (isGenericTitle && buyerId && buyerId !== 'undefined') {
                const { data: orderData } = await supabase
                    .from('daraz_orders')
                    .select('customer_name, shipping_name, customer_first_name, customer_last_name')
                    .contains('items_detail', JSON.stringify([{ buyer_id: Number(buyerId) }]))
                    .limit(1)
                    .maybeSingle();

                if (orderData) {
                    const resolvedName = orderData.customer_name || orderData.shipping_name || `${orderData.customer_first_name} ${orderData.customer_last_name}`.trim();
                    if (resolvedName) {
                        sessionTitle = resolvedName;
                    }
                }
            }

            if (!sessionTitle || sessionTitle === 'undefined') {
                sessionTitle = `Buyer ${buyerId}`;
            }

            // Upsert session details
            const sessionPayload = {
                session_id: session.session_id,
                store_id: storeId,
                buyer_id: buyerId,
                title: sessionTitle,
                head_url: session.head_url || null,
                unread_count: parseInt(session.unread_count || '0'),
                last_message_id: session.last_message_id || null,
                last_message_time: session.last_message_time ? new Date(parseInt(session.last_message_time)).toISOString() : null,
                last_message_summary: parseSummary(session.summary),
                updated_at: new Date().toISOString()
            }

            const { error: sessionError } = await supabase
                .from('daraz_chat_sessions')
                .upsert(sessionPayload, { onConflict: 'session_id' })

            if (sessionError) {
                console.error(`[ChatSync] Error saving session ${session.session_id}:`, sessionError.message)
                continue
            }

            // Sync messages for this session
            await syncDarazChatMessages(storeId, session.session_id)
        }

        revalidatePath('/dashboard/chat-ai')
        return { success: true, count: sessionList.length }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Session sync failed for store ${storeId}:`, errorMessage)
        return { success: false, reason: errorMessage }
    }
}

// 3. Fetch/Sync Messages for a single Session from Daraz API
export async function syncDarazChatMessages(storeId: string, sessionId: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        const timestamp = Date.now().toString()
        // Fetch messages from the last 30 days for this session
        const thirtyDaysAgo = (Date.now() - 30 * 24 * 60 * 60 * 1000).toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            session_id: sessionId,
            start_time: thirtyDaysAgo,
            page_size: '50'
        }

        const apiPath = '/im/message/list'
        params.sign = signRequest(apiPath, params, appSecret)

        const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        // Extract buyer and seller IDs from sessionId for self-healing
        let sessionBuyerId = '';
        let sessionSellerId = '';
        const parts = String(sessionId || '').split('_');
        if (parts.length >= 4) {
            if (parts[1] === '1') sessionBuyerId = parts[0];
            else if (parts[3] === '1') sessionBuyerId = parts[2];
            
            if (parts[1] === '2') sessionSellerId = parts[0];
            else if (parts[3] === '2') sessionSellerId = parts[2];
        }

        const messageList = response.data.data?.message_list || []
        
        let newMessagesCached = 0
        for (const msg of messageList) {
            const sendTime = msg.send_time ? new Date(parseInt(String(msg.send_time))).toISOString() : new Date().toISOString()
            
            // Check if message already exists to avoid overwriting user/system tags
            const { data: existingMsg } = await supabase
                .from('daraz_chat_messages')
                .select('message_id, tags')
                .eq('message_id', msg.message_id)
                .maybeSingle()

            if (existingMsg) continue // Skip if already cached

            const fromType = String(msg.from_account_type);
            const toType = String(msg.to_account_type);
            
            let fromAccountId = String(msg.from_account_id || '');
            let toAccountId = String(msg.to_account_id || '');
            
            if (!fromAccountId || fromAccountId === 'undefined') {
                fromAccountId = fromType === '1' ? sessionBuyerId : sessionSellerId;
            }
            if (!toAccountId || toAccountId === 'undefined') {
                toAccountId = toType === '1' ? sessionBuyerId : sessionSellerId;
            }

            const msgPayload = {
                message_id: msg.message_id,
                session_id: sessionId,
                from_account_id: fromAccountId,
                from_account_type: fromType,
                to_account_id: toAccountId,
                to_account_type: toType,
                content: msg.content,
                template_id: String(msg.template_id || '1'),
                send_time: sendTime,
                auto_reply: msg.auto_reply === 'true' || msg.auto_reply === true,
                tags: []
            }

            const { error: msgError } = await supabase
                .from('daraz_chat_messages')
                .insert(msgPayload)

            if (msgError) {
                console.error(`[ChatSync] Error saving message ${msg.message_id}:`, msgError.message)
            } else {
                newMessagesCached++

                // Detect Daraz follower confirmation — persist on session so it survives message retention cleanup
                const contentLower = String(msg.content || '').toLowerCase()
                if (contentLower.includes('store follower') || contentLower.includes('now your store')) {
                    await supabase
                        .from('daraz_chat_sessions')
                        .update({ is_follower: true, followed_at: sendTime })
                        .eq('session_id', sessionId)
                        .eq('is_follower', false) // Only update if not already marked
                    console.log(`[ChatSync] Marked session ${sessionId} as follower`)
                }

                // Trigger AI or Keyword auto-reply process ONLY if message is:
                // - Sent by buyer (from_account_type = '1')
                // - Received recently (last 5 minutes)
                const isBuyer = String(msg.from_account_type) === '1'
                const isRecent = (Date.now() - parseInt(String(msg.send_time))) < 5 * 60 * 1000
                if (isBuyer && isRecent) {
                    await processIncomingMessageAutoReply(storeId, sessionId, {
                        content: String(msg.content),
                        from_account_type: String(msg.from_account_type),
                        send_time: String(msg.send_time)
                    })
                }
            }
        }

        return { success: true, count: newMessagesCached }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Message sync failed for session ${sessionId}:`, errorMessage)
        return { success: false, error: errorMessage }
    }
}

// 4. Send Chat Message to Daraz
export async function sendChatMessage(
    storeId: string,
    sessionId: string,
    templateId: string,
    txt?: string,
    itemId?: string,
    orderId?: string,
    autoReply = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            session_id: sessionId,
            template_id: templateId
        }

        if (templateId === '1' && txt) params.txt = txt
        if (templateId === '10006' && itemId) params.item_id = itemId
        if (templateId === '10007' && orderId) params.order_id = orderId

        const apiPath = '/im/message/send'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ChatSync] Sending message (template ${templateId}) to session ${sessionId}...`)
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params, timeout: 10000 })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        const msgData = response.data.data
        const messageId = msgData?.message_id || `local_${Date.now()}`

        // Save sent message locally
        const { data: session } = await supabase
            .from('daraz_chat_sessions')
            .select('buyer_id')
            .eq('session_id', sessionId)
            .single()

        const msgPayload = {
            message_id: messageId,
            session_id: sessionId,
            from_account_id: 'seller', // identifier
            from_account_type: '2', // Seller
            to_account_id: session?.buyer_id || 'buyer',
            to_account_type: '1', // Buyer
            content: templateId === '1' ? JSON.stringify({ txt }) : JSON.stringify({ templateId, itemId, orderId }),
            template_id: templateId,
            send_time: new Date().toISOString(),
            auto_reply: autoReply,
            tags: []
        }

        await supabase.from('daraz_chat_messages').insert(msgPayload)

        // Determine the best summary text to show based on the templateId
        let summaryText = 'Interactive Template Message';
        if (templateId === '1') {
            summaryText = txt || '';
        } else if (templateId === '10006') {
            summaryText = 'Product Card';
        } else if (templateId === '10007') {
            summaryText = 'Order Card';
        } else if (templateId === '10010') {
            summaryText = 'Follow Invitation';
        }

        // Update session last message summary
        await supabase
            .from('daraz_chat_sessions')
            .update({
                last_message_id: messageId,
                last_message_time: new Date().toISOString(),
                last_message_summary: summaryText
            })
            .eq('session_id', sessionId)

        revalidatePath('/dashboard/chat-ai')
        return { success: true, messageId }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Send message failed:`, errorMessage)
        return { success: false, error: errorMessage || 'Failed to send message' }
    }
}

// 5. Open Session proactively using Order ID
export async function openSessionByOrderId(storeId: string, orderId: string): Promise<string | null> {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        
        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            order_id: String(orderId)
        }

        const apiPath = '/im/session/open'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ChatSync] Opening conversation for Order ID: ${orderId}...`)
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params, timeout: 10000 })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        return response.data.session_id || null
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Open session failed for order ${orderId}:`, errorMessage)
        return null
    }
}

// 6. Manage Settings
export async function getChatSettings(storeId: string) {
    const supabase = await createAdminClient()
    const { data } = await supabase
        .from('daraz_chat_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()

    const currentAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || ''

    if (!data) {
        // Create default settings
        const defaultSettings = {
            store_id: storeId,
            messaging_enabled: true,
            ai_enabled: false,
            auto_reply_on_new_order: false,
            new_order_template: 'Thank you for your order! We have received it and are preparing it. Please click below to follow our store for the latest updates!',
            new_order_delay_minutes: 1,
            ai_provider: 'gemini',
            openai_api_key: null,
            openai_model: 'gpt-4o-mini',
            app_url: currentAppUrl
        }
        const { data: inserted } = await supabase
            .from('daraz_chat_settings')
            .insert(defaultSettings)
            .select()
            .single()
        return inserted || defaultSettings
    }

    // If local app_url is out of sync or missing in DB, update it dynamically
    if (currentAppUrl && data.app_url !== currentAppUrl) {
        console.log(`[ChatSettings] Dynamic self-healing: updating database app_url to "${currentAppUrl}"`)
        const { data: updated } = await supabase
            .from('daraz_chat_settings')
            .update({ app_url: currentAppUrl, updated_at: new Date().toISOString() })
            .eq('store_id', storeId)
            .select()
            .single()
        if (updated) {
            return updated
        }
    }

    return data
}

export async function updateChatSettings(storeId: string, payload: Partial<ChatSettings>) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_settings')
        .update(payload)
        .eq('store_id', storeId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

// 7. Manage Message Tags
export async function updateMessageTags(messageId: string, tags: string[]) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_messages')
        .update({ tags })
        .eq('message_id', messageId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

// 8. Manage Rules (Keyword / Exact match templates)
export async function getChatRules(storeId: string) {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_chat_rules')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function addChatRule(storeId: string, rule: { match_type: 'exact' | 'keyword', pattern: string, reply_content: string }) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_rules')
        .insert({
            store_id: storeId,
            match_type: rule.match_type,
            pattern: rule.pattern.toLowerCase().trim(),
            reply_content: rule.reply_content
        })

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

export async function deleteChatRule(ruleId: string) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_rules')
        .delete()
        .eq('id', ruleId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

// 9. Auto Reply processing (AI & Keyword Matching rules)
export interface DarazMessage {
    content: string
    from_account_type: string | number
    send_time: string | number
}

export async function processIncomingMessageAutoReply(storeId: string, sessionId: string, msg: DarazMessage) {
    try {
        const supabase = await createAdminClient()
        const settings = await getChatSettings(storeId)

        // Parse incoming message content
        let userText = ''
        try {
            const parsed = JSON.parse(msg.content)
            userText = parsed.txt || parsed.content || msg.content || ''
        } catch {
            userText = msg.content || ''
        }

        const cleanText = userText.toLowerCase().trim()
        if (!cleanText) return

        // A. Check Exact Matches
        const rules = await getChatRules(storeId)
        const exactMatch = rules.find(r => r.match_type === 'exact' && cleanText === r.pattern.toLowerCase().trim())
        if (exactMatch) {
            console.log(`[AutoReply] Exact match found for: "${userText}" -> replying: "${exactMatch.reply_content}"`)
            await sendChatMessage(storeId, sessionId, '1', exactMatch.reply_content, undefined, undefined, true)
            return
        }

        // B. Check Keyword Matches
        const keywordMatch = rules.find(r => r.match_type === 'keyword' && cleanText.includes(r.pattern.toLowerCase().trim()))
        if (keywordMatch) {
            console.log(`[AutoReply] Keyword match found in: "${userText}" -> replying: "${keywordMatch.reply_content}"`)
            await sendChatMessage(storeId, sessionId, '1', keywordMatch.reply_content, undefined, undefined, true)
            return
        }

        // C. AI Auto-Reply (Supports Gemini and OpenAI)
        if (settings.ai_enabled) {
            const isOpenAi = settings.ai_provider === 'openai'
            const apiKey = isOpenAi 
                ? settings.openai_api_key 
                : (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)

            if (!apiKey) {
                console.warn(`[AutoReply] AI enabled but API key for provider ${settings.ai_provider || 'gemini'} is missing.`)
                return
            }

            console.log(`[AutoReply] Triggering AI (${settings.ai_provider || 'gemini'}) for message: "${userText}"`)

            // Context gathering: Fetch some active products to give stock context
            const { data: products } = await supabase
                .from('products')
                .select('product_name, seller_sku1, seller_sku2, is_deleted')
                .eq('is_deleted', false)
                .limit(15)

            let productsContext = 'Here is a list of some items we have in stock:\n'
            if (products && products.length > 0) {
                productsContext += products.map(p => `- ${p.product_name} (SKU: ${p.seller_sku1 || 'N/A'})`).join('\n')
            } else {
                productsContext += 'No products inventory loaded.'
            }

            // Fetch last 5 messages in this session for conversation memory
            const { data: recentMsgs } = await supabase
                .from('daraz_chat_messages')
                .select('from_account_type, content, send_time')
                .eq('session_id', sessionId)
                .order('send_time', { ascending: false })
                .limit(5)

            let historyContext = ''
            if (recentMsgs && recentMsgs.length > 0) {
                const sortedMsgs = [...recentMsgs].reverse()
                historyContext = sortedMsgs.map(m => {
                    let text = m.content
                    try {
                        const p = JSON.parse(m.content)
                        text = p.txt || m.content
                    } catch {}
                    const sender = m.from_account_type === '1' ? 'Seller (You)' : 'Buyer (Customer)'
                    return `[${sender}]: ${text}`
                }).join('\n')
            }

            const systemPrompt = `You are an automated AI Customer Service Assistant for our online store on Daraz.
Your goal is to answer the customer's questions politely, accurately, and concisely. Keep responses short (under 2-3 sentences) because customers read them on mobile chat.

Store Inventory Context:
${productsContext}

Recent Conversation History:
${historyContext}
[Buyer (Customer)]: ${userText}

Generate a friendly response in English or Nepali based on the customer's language. Do not make up facts. If you do not know the answer (e.g. tracking code details not in context), politely tell the customer that a human support agent will review and reply shortly.
Response:`

            let replyText = null
            if (isOpenAi) {
                console.log(`[AutoReply] Calling OpenAI API (${settings.openai_model || 'gpt-4o-mini'})...`)
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: settings.openai_model || 'gpt-4o-mini',
                        messages: [
                            { role: 'user', content: systemPrompt }
                        ],
                        max_tokens: 150,
                        temperature: 0.7
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 10000
                    }
                )
                replyText = response.data?.choices?.[0]?.message?.content
            } else {
                console.log('[AutoReply] Calling Gemini API...')
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        contents: [{
                            parts: [{ text: systemPrompt }]
                        }]
                    },
                    {
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
                replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
            }

            if (replyText && replyText.trim()) {
                const cleanReply = replyText.replace(/AI Assistant:/gi, '').trim()
                console.log(`[AutoReply] AI response generated: "${cleanReply}"`)
                
                await sendChatMessage(storeId, sessionId, '1', cleanReply, undefined, undefined, true)
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AutoReply] Auto-reply processor encountered an error:`, errorMessage)
    }
}
