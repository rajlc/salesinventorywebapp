'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import axios from 'axios'
import { getProductQAs, type ProductQA } from './product-qa-actions'

import { DEFAULT_AI_AGENT_SYSTEM_INSTRUCTIONS, isClosingAcknowledgment, type EffectiveAiConfig } from '../constants'

function stripHtml(html: string | null | undefined): string {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Seamlessly resolve AI credentials configured in Settings > AI Integration (/dashboard/settings/ai-integration)
export async function getEffectiveAiCredentials(storeSettings?: Partial<ChatSettings> | null): Promise<EffectiveAiConfig> {
    const supabase = await createAdminClient()

    // 1. Fetch Global AI integration settings from app_settings
    const { data: aiRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_ai_settings')
        .maybeSingle()

    const globalVal = aiRow?.value || {}
    const globalGeminiKey = String(globalVal.geminiApiKey || (globalVal.provider === 'gemini' ? globalVal.apiKey : '') || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim()
    const globalOpenAiKey = String(globalVal.openaiApiKey || (globalVal.provider === 'openai' ? globalVal.apiKey : '') || process.env.OPENAI_API_KEY || '').trim()

    // 2. Determine provider: store-specific choice takes precedence, then global choice, default to 'gemini'
    const provider: 'gemini' | 'openai' = (storeSettings?.ai_provider === 'openai' || (!storeSettings?.ai_provider && globalVal.provider === 'openai'))
        ? 'openai'
        : 'gemini'

    let apiKey = ''
    let model = ''
    let source: EffectiveAiConfig['source'] = 'none'

    if (provider === 'gemini') {
        apiKey = globalGeminiKey
        if (apiKey) {
            source = (globalVal.geminiApiKey || (globalVal.provider === 'gemini' && globalVal.apiKey)) ? 'global_settings' : 'env_variable'
        }
        // Normalize model to active Google AI Studio generation endpoints
        const rawModel = globalVal.model || 'gemini-3.5-flash'
        if (rawModel.includes('3.5') || rawModel.includes('3.1') || rawModel.includes('3.6') || rawModel.includes('3.8') || rawModel.includes('3.7') || rawModel.includes('flash-latest') || rawModel.includes('3-flash')) {
            model = rawModel
        } else if (rawModel.includes('pro')) {
            model = 'gemini-2.5-pro'
        } else {
            model = 'gemini-3.5-flash'
        }
    } else {
        // OpenAI
        const storeKey = storeSettings?.openai_api_key?.trim()
        if (storeKey) {
            apiKey = storeKey
            source = 'store_override'
        } else if (globalOpenAiKey) {
            apiKey = globalOpenAiKey
            source = (globalVal.openaiApiKey || (globalVal.provider === 'openai' && globalVal.apiKey)) ? 'global_settings' : 'env_variable'
        }
        model = storeSettings?.openai_model || globalVal.model || 'gpt-4o-mini'
    }

    return {
        provider,
        apiKey,
        model,
        geminiApiKey: globalGeminiKey,
        openaiApiKey: globalOpenAiKey,
        source,
        hasGeminiKey: Boolean(globalGeminiKey),
        hasOpenAiKey: Boolean(globalOpenAiKey)
    }
}

// Action for client UI to display active AI Integration status
export async function getGlobalAiIntegrationInfo() {
    const config = await getEffectiveAiCredentials()
    return {
        hasGeminiKey: config.hasGeminiKey,
        hasOpenAiKey: config.hasOpenAiKey,
        globalGeminiApiKeyMasked: config.geminiApiKey ? `${config.geminiApiKey.substring(0, 4)}••••••••${config.geminiApiKey.slice(-4)}` : '',
        globalOpenAiApiKeyMasked: config.openaiApiKey ? `${config.openaiApiKey.substring(0, 4)}••••••••${config.openaiApiKey.slice(-4)}` : '',
        globalProvider: config.provider,
        globalModel: config.model
    }
}

// Robust Google Gemini caller with candidate fallback
async function callGeminiApi(apiKey: string, promptText: string, preferredModel = 'gemini-3.5-flash', isJson = false): Promise<string> {
    const candidates = Array.from(new Set([
        preferredModel,
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-3.6-flash',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest'
    ].filter(Boolean)))

    let lastError = ''
    for (const m of candidates) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
            const body: any = {
                contents: [{ parts: [{ text: promptText }] }]
            }
            if (isJson) {
                body.generationConfig = { responseMimeType: 'application/json' }
            }
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(12000)
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData?.error?.message || `HTTP ${res.status}`)
            }
            const data = await res.json()
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) return text
        } catch (err: any) {
            lastError = err?.message || 'Gemini request failed'
            console.warn(`[GeminiCall] Model ${m} failed: ${lastError}. Trying next candidate...`)
        }
    }
    throw new Error(lastError || 'All Gemini model candidates failed')
}

// Robust OpenAI caller
async function callOpenAiApi(apiKey: string, promptText: string, model = 'gpt-4o-mini', isJson = false): Promise<string> {
    const body: any = {
        model,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.6
    }
    if (isJson) {
        body.response_format = { type: 'json_object' }
    }
    const res = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        timeout: 12000
    })
    return res.data?.choices?.[0]?.message?.content || ''
}

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
    ai_analysis_enabled?: boolean
    ai_agent_instructions?: string
    ai_cooldown_hours?: number
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

        try {
            revalidatePath('/dashboard/chat-ai')
        } catch {
            // Ignore revalidatePath error outside request context (e.g. background tasks / cron)
        }
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
        // According to Daraz IM API documentation: when requesting the first page, start_time must be the current timestamp
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            session_id: sessionId,
            start_time: timestamp,
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
                // - Received recently (last 15 minutes, with robust timestamp parsing)
                const isBuyer = String(msg.from_account_type) === '1'
                
                let msgTimeMs = Date.now()
                if (msg.send_time) {
                    const parsedNum = Number(msg.send_time)
                    if (!isNaN(parsedNum) && parsedNum > 1000000000) {
                        msgTimeMs = parsedNum < 10000000000 ? parsedNum * 1000 : parsedNum
                    } else {
                        const parsedDate = new Date(msg.send_time).getTime()
                        if (!isNaN(parsedDate)) msgTimeMs = parsedDate
                    }
                }
                const isRecent = Math.abs(Date.now() - msgTimeMs) < 15 * 60 * 1000

                if (isBuyer && isRecent) {
                    await processIncomingMessageAutoReply(storeId, sessionId, {
                        content: String(msg.content),
                        from_account_type: String(msg.from_account_type),
                        send_time: String(msg.send_time)
                    })
                }
            }
        }

        // Update session last message metadata to reflect latest message from Daraz
        if (messageList.length > 0) {
            const sortedByTime = [...messageList].sort((a: any, b: any) => Number(b.send_time || 0) - Number(a.send_time || 0))
            const latestMsg = sortedByTime[0]
            const latestSendTime = latestMsg.send_time ? new Date(parseInt(String(latestMsg.send_time))).toISOString() : new Date().toISOString()
            const summary = parseSummary(latestMsg.content)
            await supabase
                .from('daraz_chat_sessions')
                .update({
                    last_message_id: latestMsg.message_id,
                    last_message_time: latestSendTime,
                    last_message_summary: summary,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId)
        }

        // If new messages were cached and AI analysis is enabled, update analysis
        if (newMessagesCached > 0) {
            getChatSettings(storeId).then(settings => {
                if (settings.ai_analysis_enabled) {
                    generateSessionAiAnalysisAction(storeId, sessionId).catch(err => {
                        console.warn(`[ChatSync] AI analysis failed for session ${sessionId}:`, err.message)
                    })
                }
            }).catch(() => {})
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
            .maybeSingle()

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

        try {
            revalidatePath('/dashboard/chat-ai')
        } catch {
            // Ignore revalidatePath error outside request context
        }
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

        const sessionId = response.data?.session_id || response.data?.data?.session_id || null

        // Self-heal: Ensure session row exists in daraz_chat_sessions so that sendChatMessage update works
        if (sessionId) {
            const supabase = await createAdminClient()
            let buyerId = '';
            const parts = String(sessionId).split('_');
            if (parts.length >= 4) {
                if (parts[1] === '1') buyerId = parts[0];
                else if (parts[3] === '1') buyerId = parts[2];
            }

            const { data: existingSession } = await supabase
                .from('daraz_chat_sessions')
                .select('session_id')
                .eq('session_id', sessionId)
                .maybeSingle()

            if (!existingSession) {
                let sessionTitle = `Buyer ${buyerId || 'Customer'}`
                const { data: orderData } = await supabase
                    .from('daraz_orders')
                    .select('customer_name, shipping_name, customer_first_name, customer_last_name')
                    .eq('order_id', String(orderId))
                    .maybeSingle()

                if (orderData) {
                    const resolvedName = orderData.customer_name || orderData.shipping_name || `${orderData.customer_first_name || ''} ${orderData.customer_last_name || ''}`.trim()
                    if (resolvedName) sessionTitle = resolvedName
                }

                await supabase.from('daraz_chat_sessions').upsert({
                    session_id: sessionId,
                    store_id: storeId,
                    buyer_id: buyerId || 'buyer',
                    title: sessionTitle,
                    unread_count: 0,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'session_id' })
            }
        }

        return sessionId
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
            app_url: currentAppUrl,
            ai_analysis_enabled: false,
            ai_agent_instructions: DEFAULT_AI_AGENT_SYSTEM_INSTRUCTIONS,
            ai_cooldown_hours: 2
        }
        const { data: inserted } = await supabase
            .from('daraz_chat_settings')
            .insert(defaultSettings)
            .select()
            .single()
        return inserted || defaultSettings
    }

    // Dynamic self-heal default instructions if empty
    if (!data.ai_agent_instructions || !data.ai_agent_instructions.trim()) {
        data.ai_agent_instructions = DEFAULT_AI_AGENT_SYSTEM_INSTRUCTIONS
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

// 9. Session Urgency & AI Analysis Actions
export async function toggleSessionUrgent(sessionId: string, isUrgent: boolean, reason?: string) {
    try {
        const supabase = await createAdminClient()
        const { error } = await supabase
            .from('daraz_chat_sessions')
            .update({
                is_urgent: isUrgent,
                urgent_reason: isUrgent ? (reason || 'Marked as urgent by staff') : null,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)

        if (error) throw error
        try { revalidatePath('/dashboard/chat-ai') } catch {}
        return { success: true }
    } catch (err: any) {
        console.error('[SessionUrgent] Error updating session:', err.message)
        return { success: false, error: err.message }
    }
}

export async function generateSessionAiAnalysisAction(storeId: string, sessionId: string) {
    try {
        const supabase = await createAdminClient()
        const settings = await getChatSettings(storeId)

        // If AI Analysis is explicitly disabled for this store, exit cleanly
        if (settings && settings.ai_analysis_enabled === false) {
            return { success: false, skipped: true, error: 'AI Analysis is not enabled for this store' }
        }

        // 1. Fetch Session details
        const { data: session } = await supabase
            .from('daraz_chat_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle()

        if (!session) throw new Error('Session not found')

        // 2. Fetch Buyer Orders (prioritize Pending > Ready to Ship > Shipped > Delivered > Cancel)
        let ordersSummary = 'No recent orders found for this buyer.'
        let prioritizedOrder: any = null
        if (session.buyer_id) {
            const safeTitle = (session.title || '').replace(/[,()]/g, ' ').trim()
            const isGenericBuyer = !safeTitle || /^buyer\s*\d*$/i.test(safeTitle)
            const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

            let orderQuery = supabase
                .from('daraz_orders')
                .select('id, order_number, order_status, order_date, customer_name, price, daraz_order_items(id, product_name, seller_sku, quantity, amount)')
                .gte('order_date', cutoffDate)
                .order('order_date', { ascending: false })
                .limit(5)

            if (!isGenericBuyer && safeTitle.length >= 3) {
                orderQuery = orderQuery.or(`customer_name.ilike.%${safeTitle}%,items_detail.cs.[{"buyer_id":${session.buyer_id}}]`)
            } else {
                orderQuery = orderQuery.filter('items_detail', 'cs', `[{"buyer_id":${session.buyer_id}}]`)
            }

            let orders: any[] | null = null
            try {
                const res: any = await Promise.race([
                    orderQuery,
                    new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3500))
                ])
                orders = res?.data || null
            } catch {
                orders = null
            }

            if (orders && orders.length > 0) {
                const statusWeight: Record<string, number> = {
                    'pending': 10,
                    'ready to ship': 8,
                    'shipped': 6,
                    'delivered': 4,
                    'cancel': 1,
                    'cancelled': 1
                }
                const sortedOrders = [...orders].sort((a, b) => {
                    const wa = statusWeight[String(a.order_status).toLowerCase()] || 3
                    const wb = statusWeight[String(b.order_status).toLowerCase()] || 3
                    return wb - wa
                })
                prioritizedOrder = sortedOrders[0]

                ordersSummary = sortedOrders.map(o => {
                    const items = (o.daraz_order_items || []).map((i: any) => `${i.product_name} (Qty: ${i.quantity})`).join(', ')
                    return `Order #${o.order_number} | Status: ${o.order_status} | Date: ${o.order_date ? new Date(o.order_date).toLocaleDateString() : 'N/A'} | Price: Rs. ${o.price || 'N/A'} | Items: ${items || 'N/A'}`
                }).join('\n')
            }
        }

        // 3. Fetch Recent Messages (up to 15 to capture full context)
        const { data: messages } = await supabase
            .from('daraz_chat_messages')
            .select('from_account_type, content, send_time, template_id')
            .eq('session_id', sessionId)
            .order('send_time', { ascending: false })
            .limit(15)

        let chatHistory = ''
        let latestBuyerInquiry = ''
        let latestProductCardTitle = ''
        let latestProductCardPrice = ''

        if (messages && messages.length > 0) {
            // Find the most recent buyer message and product card
            for (const m of messages) {
                const isBuyer = String(m.from_account_type) === '1'
                try {
                    const parsed = JSON.parse(m.content)
                    if (isBuyer && !latestBuyerInquiry && (parsed.txt || parsed.content)) {
                        latestBuyerInquiry = parsed.txt || parsed.content
                    }
                    if ((m.template_id === '10006' || parsed.itemId) && !latestProductCardTitle) {
                        latestProductCardTitle = parsed.title || ''
                        latestProductCardPrice = parsed.price || parsed.item_price || parsed.special_price || ''
                    }
                } catch {
                    if (isBuyer && !latestBuyerInquiry) {
                        latestBuyerInquiry = m.content
                    }
                }
            }

            chatHistory = [...messages].reverse().map(m => {
                let text = m.content
                try {
                    const parsed = JSON.parse(m.content)
                    if (parsed.txt) text = parsed.txt
                    else if (m.template_id === '10006' || parsed.itemId) {
                        const priceStr = parsed.price ? ` - Listed Price: ${parsed.price}` : ''
                        text = `[Product Inquiry Card: ${parsed.title || ''}${priceStr}]`
                    }
                    else if (m.template_id === '10007' || parsed.orderId) text = `[Order Card: #${parsed.orderId}]`
                } catch {}
                const sender = String(m.from_account_type) === '1' ? 'Buyer' : 'Seller'
                return `[${sender}]: ${text}`
            }).join('\n')
        }

        // 4. Generate AI Analysis with explicit NEW MESSAGE PRIORITY
        const prompt = `You are an expert E-Commerce Customer & Order Intelligence Analyst.
Analyze the following buyer conversation and order records for a seller on Daraz:

Buyer Name / Title: ${session.title} (Buyer ID: ${session.buyer_id})
Recent Orders (Prioritized):
${ordersSummary}

*** CRITICAL PRIORITY: FOCUS ON THE LATEST NEW MESSAGE ***
The customer's MOST RECENT inquiry represents their current real-time intent:
- Latest Inquiry from Buyer: "${latestBuyerInquiry || 'N/A'}"
- Latest Product Looked At: "${latestProductCardTitle || 'N/A'}" ${latestProductCardPrice ? `(Price: ${latestProductCardPrice})` : ''}

Full Recent Conversation History:
${chatHistory || 'No messages yet.'}

Instructions:
1. Provide a concise 2-3 sentence summary of:
   - The customer's CURRENT active inquiry (highlighting their latest question and the specific product they just asked about).
   - The current order situation (highlighting pending/active orders first, or noting if they have no active orders).
2. Check if the customer made an urgent request (e.g. wants different color, change address, change phone, cancel order, or angry complaint).
   NOTE: If the customer just asked for a product price or sent a product card, that is a standard inquiry (not urgent unless explicitly demanding an escalation).
3. Output your response as a valid JSON object matching this structure:
{
  "summary": "Concise 2-3 sentence summary here focusing on the newest inquiry",
  "is_urgent": true or false,
  "urgent_reason": "Specific reason if urgent, otherwise null"
}`

        // 4. Generate AI Analysis using effective credentials from Settings > AI Integration
        const effectiveAi = await getEffectiveAiCredentials(settings)
        if (!effectiveAi.apiKey) {
            throw new Error(`API key not configured for ${effectiveAi.provider === 'openai' ? 'OpenAI' : 'Google Gemini'}. Please configure your API key in Settings > AI Integration (/dashboard/settings/ai-integration).`)
        }

        let aiJson: { summary: string; is_urgent: boolean; urgent_reason?: string | null } = {
            summary: `Customer ${session.title} active thread. Latest Inquiry: "${latestBuyerInquiry || 'Product Inquiry'}". Prioritized Order: ${prioritizedOrder?.order_number || 'None'} (${prioritizedOrder?.order_status || 'N/A'}).`,
            is_urgent: false,
            urgent_reason: null
        }

        try {
            let rawContent = ''
            if (effectiveAi.provider === 'openai') {
                rawContent = await callOpenAiApi(effectiveAi.apiKey, prompt, effectiveAi.model, true)
            } else {
                rawContent = await callGeminiApi(effectiveAi.apiKey, prompt, effectiveAi.model, true)
            }
            if (rawContent) {
                const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim()
                aiJson = JSON.parse(cleanJson)
            }
        } catch (apiErr: any) {
            console.error('[SessionAiAnalysis] AI Provider API error:', apiErr.message)
            throw new Error(`AI Analysis failed: ${apiErr.message}`)
        }

        // 5. Update session in database
        const updatePayload: Record<string, any> = {
            ai_summary: aiJson.summary,
            ai_summary_updated_at: new Date().toISOString()
        }
        if (aiJson.is_urgent) {
            updatePayload.is_urgent = true
            updatePayload.urgent_reason = aiJson.urgent_reason || 'Urgent request detected by AI analysis'
        } else {
            updatePayload.is_urgent = false
            updatePayload.urgent_reason = null
        }

        await supabase
            .from('daraz_chat_sessions')
            .update(updatePayload)
            .eq('session_id', sessionId)

        try { revalidatePath('/dashboard/chat-ai') } catch {}

        return {
            success: true,
            analysis: {
                summary: aiJson.summary,
                is_urgent: aiJson.is_urgent,
                urgent_reason: aiJson.urgent_reason,
                prioritized_order: prioritizedOrder,
                updated_at: new Date().toISOString()
            }
        }
    } catch (err: any) {
        console.error('[SessionAiAnalysis] Error:', err.message)
        return { success: false, error: err.message }
    }
}

// 10. Auto Reply processing (AI, RAG Knowledge Base & Keyword Matching rules)
export interface DarazMessage {
    content: string
    from_account_type: string | number
    send_time: string | number
}

// Guarded entry point: ensures only ONE auto-reply is generated per buyer burst, even when
// Daraz fires several webhook events at once (text + order card + welcome message) or the
// manual sync runs in parallel. Uses an atomic insert on app_settings(key) as a cross-instance lock.
export async function processIncomingMessageAutoReply(storeId: string, sessionId: string, msg: DarazMessage) {
    // 1. Ignore non-text events (order cards / product cards / follow cards / greetings) as reply triggers
    let extractedUserText = ''
    try {
        const parsed = JSON.parse(msg.content)
        if (parsed && typeof parsed === 'object') {
            if (typeof parsed.txt === 'string' && parsed.txt.trim()) {
                // Check if it's a Daraz automatic greeting template (contains nested JSON with en/ne)
                try {
                    const inner = JSON.parse(parsed.txt)
                    if (inner && (inner.en || inner.ne)) {
                        console.log(`[AutoReply] Skipping auto-greeting template for session ${sessionId}`)
                        return
                    }
                } catch {}
                extractedUserText = parsed.txt.trim()
            } else if (typeof parsed.message === 'string' && parsed.message.trim()) {
                extractedUserText = parsed.message.trim()
            } else {
                console.log(`[AutoReply] Skipping non-text/card event for session ${sessionId}`)
                return
            }
        } else {
            extractedUserText = String(msg.content || '').trim()
        }
    } catch {
        extractedUserText = String(msg.content || '').trim()
    }

    if (!extractedUserText) {
        console.log(`[AutoReply] Empty text message for session ${sessionId}, skipping.`)
        return
    }

    const supabase = await createAdminClient()
    const lockKey = `ai_reply_lock_${sessionId}`

    // 2. Acquire atomic lock (key is unique). Break stale locks older than 60s.
    let acquired = false
    for (let attempt = 0; attempt < 2 && !acquired; attempt++) {
        const { error } = await supabase.from('app_settings').insert({ key: lockKey, value: { locked_at: Date.now() } })
        if (!error) { acquired = true; break }
        const { data: existing } = await supabase.from('app_settings').select('value').eq('key', lockKey).maybeSingle()
        const lockedAt = Number(existing?.value?.locked_at || 0)
        if (existing && Date.now() - lockedAt > 60000) {
            await supabase.from('app_settings').delete().eq('key', lockKey)
        } else {
            break
        }
    }
    if (!acquired) {
        console.log(`[AutoReply] Another reply is already being generated for session ${sessionId}, skipping duplicate.`)
        return
    }

    try {
        // 3. Prevent duplicate replies: check if the latest message in this session is already an AI auto-reply
        const { data: latestMsgs } = await supabase
            .from('daraz_chat_messages')
            .select('message_id, from_account_type, auto_reply, template_id, send_time')
            .eq('session_id', sessionId)
            .order('send_time', { ascending: false })
            .limit(2)

        const topMsg = latestMsgs?.[0]
        if (topMsg && topMsg.auto_reply === true && String(topMsg.from_account_type) === '2') {
            console.log(`[AutoReply] Latest message in session ${sessionId} is already an AI auto-reply, skipping duplicate.`)
            return
        }

        await runAutoReply(storeId, sessionId, msg)
    } finally {
        await supabase.from('app_settings').delete().eq('key', lockKey)
    }
}

async function runAutoReply(storeId: string, sessionId: string, msg: DarazMessage) {
    try {
        const supabase = await createAdminClient()
        const settings = await getChatSettings(storeId)

        // 0. Check Cooldown / Handover Mute
        const { data: session } = await supabase
            .from('daraz_chat_sessions')
            .select('ai_paused_until, buyer_id, title')
            .eq('session_id', sessionId)
            .maybeSingle()

        if (session?.ai_paused_until && new Date(session.ai_paused_until).getTime() > Date.now()) {
            console.log(`[AutoReply] AI is paused/muted for session ${sessionId} until ${session.ai_paused_until} (human handover active). Skipping auto-reply.`)
            return
        }

        // Parse incoming message content safely (never treat card JSON as plain text)
        let userText = ''
        try {
            const parsed = JSON.parse(msg.content)
            if (parsed && typeof parsed === 'object') {
                userText = typeof parsed.txt === 'string' ? parsed.txt : (typeof parsed.message === 'string' ? parsed.message : '')
            } else {
                userText = typeof msg.content === 'string' ? msg.content : ''
            }
        } catch {
            userText = typeof msg.content === 'string' ? msg.content : ''
        }

        const cleanText = userText.toLowerCase().trim()
        if (!cleanText) return

        // 0.1 End of Conversation Cut-Off: If customer sends pure closing acknowledgment (e.g. "Okay", "hunxa", "dhanyabad", "thank you", "huss", "👍"), do not reply
        if (isClosingAcknowledgment(cleanText)) {
            console.log(`[AutoReply] Customer sent closing acknowledgment ("${cleanText}"), ending conversation gracefully without reply.`)
            return
        }

        const cooldownHours = Number(settings.ai_cooldown_hours) || 2

        // A. Urgent Order Modification Detection (Color, Address, Phone, Cancel)
        // Must specifically match an intent to CHANGE or MODIFY an existing order
        const isColorRequest = /(change|modify|arkai|fernu|sattnu).*(color|colour|size|variant)/i.test(cleanText) ||
                               /(order|parcel|item).*(change|arkai).*(color|size)/i.test(cleanText) ||
                               /(pack|send|pathaunu|dinus).*(black|blue|red|green|white|yellow|gold|silver|pink)\s+(color|colour|ko|size|ma)/i.test(cleanText)
        const isAddressRequest = /(change|update|naya|arkai).*(address|thikana|location|ghar)/i.test(cleanText)
        const isPhoneRequest = /(change|update|naya|arkai).*(phone|number|mobile)/i.test(cleanText)
        const isCancelRequest = /(cancel|cancellation|order radd|cancel garnu)/i.test(cleanText)

        if (isColorRequest || isAddressRequest || isPhoneRequest || isCancelRequest) {
            let reason = 'Urgent customer order modification'
            if (isColorRequest) reason = `Customer requested color/variant change: "${userText.substring(0, 50)}"`
            else if (isAddressRequest) reason = `Customer requested address change: "${userText.substring(0, 50)}"`
            else if (isPhoneRequest) reason = `Customer requested phone change: "${userText.substring(0, 50)}"`
            else if (isCancelRequest) reason = `Customer requested order cancellation: "${userText.substring(0, 50)}"`

            const pausedUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString()
            await supabase
                .from('daraz_chat_sessions')
                .update({
                    is_urgent: true,
                    urgent_reason: reason,
                    ai_paused_until: pausedUntil,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId)

            const ackReply = "Hajur, tapai ko request hami le note gareka xau. Hamro team le parcel dispatch garnu aghi tapailai direct call/contact garnecha. / Thank you, we have noted your request. Our support team will review and contact you before dispatch."
            await sendChatMessage(storeId, sessionId, '1', ackReply, undefined, undefined, true)
            try { revalidatePath('/dashboard/chat-ai') } catch {}
            return
        }

        // B. Check Exact Matches from Rules
        const rules = await getChatRules(storeId)
        const exactMatch = rules.find(r => r.match_type === 'exact' && cleanText === r.pattern.toLowerCase().trim())
        if (exactMatch) {
            console.log(`[AutoReply] Exact match found for: "${userText}" -> replying: "${exactMatch.reply_content}"`)
            await sendChatMessage(storeId, sessionId, '1', exactMatch.reply_content, undefined, undefined, true)
            return
        }

        // C. Check Keyword Matches from Rules
        const keywordMatch = rules.find(r => r.match_type === 'keyword' && cleanText.includes(r.pattern.toLowerCase().trim()))
        if (keywordMatch) {
            console.log(`[AutoReply] Keyword match found in: "${userText}" -> replying: "${keywordMatch.reply_content}"`)
            await sendChatMessage(storeId, sessionId, '1', keywordMatch.reply_content, undefined, undefined, true)
            return
        }

        // D. AI Auto-Reply (RAG Knowledge Base & Smart Handover)
        if (settings.ai_enabled) {
            const effectiveAi = await getEffectiveAiCredentials(settings)

            if (!effectiveAi.apiKey) {
                console.warn(`[AutoReply] AI enabled but API key for provider ${effectiveAi.provider} is missing. Please configure it in Settings > AI Integration.`)
                return
            }

            console.log(`[AutoReply] Triggering AI (${effectiveAi.provider}, model: ${effectiveAi.model}) for message: "${userText}"`)

            // 1. Check Product Card or Active Order Item for Product Context
            const { data: sessionMsgs } = await supabase
                .from('daraz_chat_messages')
                .select('template_id, content')
                .eq('session_id', sessionId)
                .order('send_time', { ascending: false })
                .limit(10)

            let targetItemId: string | null = null
            let targetProductTitle: string | null = null
            let targetProductPrice: string | null = null
            let targetProductOldPrice: string | null = null
            let targetProductUrl: string | null = null
            let targetProductSku: string | null = null

            if (sessionMsgs) {
                for (const sm of sessionMsgs) {
                    if (String(sm.template_id) === '10006' && sm.content) {
                        try {
                            const p = JSON.parse(sm.content)
                            if (p.itemId || p.item_id) {
                                targetItemId = String(p.itemId || p.item_id)
                                targetProductTitle = p.title || targetProductTitle
                                targetProductPrice = p.price || p.item_price || p.special_price || p.newProduct?.voucherPrice || targetProductPrice
                                targetProductOldPrice = p.oldPrice || p.originalPrice || targetProductOldPrice
                                targetProductUrl = p.actionUrl || targetProductUrl
                                targetProductSku = p.skuId || p.sku || targetProductSku
                                break
                            }
                        } catch {}
                    }
                }
            }

            // 2. Fetch Buyer's Orders (Prioritizing Pending orders)
            let buyerOrdersContext = 'No active order records found for this buyer.'
            let buyerOrders: any[] | null = null
            if (session?.buyer_id) {
                const safeTitle = (session?.title || '').replace(/[,()]/g, ' ').trim()
                const isGenericBuyer = !safeTitle || /^buyer\s*\d*$/i.test(safeTitle)
                const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

                let buyerOrderQuery = supabase
                    .from('daraz_orders')
                    .select('order_number, order_status, order_date, price, daraz_order_items(product_name, seller_sku, quantity, amount)')
                    .gte('order_date', cutoffDate)
                    .order('order_date', { ascending: false })
                    .limit(3)

                if (!isGenericBuyer && safeTitle.length >= 3) {
                    buyerOrderQuery = buyerOrderQuery.or(`customer_name.ilike.%${safeTitle}%,items_detail.cs.[{"buyer_id":${session.buyer_id}}]`)
                } else {
                    buyerOrderQuery = buyerOrderQuery.filter('items_detail', 'cs', `[{"buyer_id":${session.buyer_id}}]`)
                }

                try {
                    const res: any = await Promise.race([
                        buyerOrderQuery,
                        new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3500))
                    ])
                    buyerOrders = res?.data || null
                } catch {
                    buyerOrders = null
                }

                if (buyerOrders && buyerOrders.length > 0) {
                    buyerOrdersContext = buyerOrders.map(bo => {
                        const items = (bo.daraz_order_items || []).map((i: any) => `${i.product_name} (Qty: ${i.quantity})`).join(', ')
                        return `Order #${bo.order_number}: Status is "${bo.order_status}", Placed on ${bo.order_date ? new Date(bo.order_date).toLocaleDateString() : 'N/A'}. Total: Rs. ${bo.price || 'N/A'}. Items: ${items}`
                    }).join('\n')
                }
            }

            // Detect Damage complaints vs Non-Delivered Order status discrepancy
            let orderDiscrepancyContext = ''
            const isDamageComplaint = /(damage|broken|futeko|bigreko|defective|crack|chirkeko|tukra|bhatkeko|chalena|problem aayo|khrab|faulty|kam gardaina)/i.test(cleanText)
            const isReturnRefundRequest = /(return|refund|paisa firta|saman firta|arkai saman|wrong product|wrong item|exchange)/i.test(cleanText)

            if (buyerOrders && buyerOrders.length > 0) {
                const latestOrder = buyerOrders[0]
                const statusLower = String(latestOrder.order_status || '').toLowerCase()
                const isNotDelivered = !statusLower.includes('deliver') && !statusLower.includes('complete') && !statusLower.includes('cancel')
                if (isDamageComplaint && isNotDelivered) {
                    orderDiscrepancyContext = `
CRITICAL ORDER STATUS & DAMAGE DISCREPANCY:
- The customer is reporting product damage or defect ("${userText}"), but in our database, their active Order #${latestOrder.order_number} has status "${latestOrder.order_status}" (IT IS NOT YET MARKED AS DELIVERED in Daraz system).
- You MUST ask the customer: "Hajur, yo parcel tapailai receive / deliver bhaisakeko ho? Hamro system ma tapai ko order #${latestOrder.order_number} aile '${latestOrder.order_status}' status ma dekhairakheko chha ra delivered mark bhaesakeko chhaina. Hamro team le yesbare courier/rider ra system ma check garera investigate garnechha. Kripaya package ko photo/video share garidinuhola."
- Do NOT assume the product was already delivered. Append "[ACTION:HANDOVER_TO_HUMAN]" at the end.`
                }
            }

            // 3. Product Details & Q&A Knowledge Base
            let targetProductData: any = null
            let targetProductQAs: ProductQA[] = []

            if (targetItemId) {
                const { data: prod } = await supabase
                    .from('products')
                    .select('id, product_name, product_title, highlights, description, special_price, regular_price, daraz_product_url, seller_sku1')
                    .or(`daraz_product_url.ilike.%-i${targetItemId}-%,seller_sku1.ilike.${targetItemId}%`)
                    .maybeSingle()

                targetProductData = prod
                targetProductQAs = await getProductQAs({ darazItemId: targetItemId, productId: prod?.id })
            }

            let productKnowledgeContext = ''
            if (targetProductData || targetItemId || targetProductTitle) {
                const cleanH = stripHtml(targetProductData?.highlights)
                const cleanD = stripHtml(targetProductData?.description).substring(0, 400)
                const resolvedPrice = targetProductData?.special_price 
                    ? `Rs. ${targetProductData.special_price}` 
                    : (targetProductData?.regular_price ? `Rs. ${targetProductData.regular_price}` : (targetProductPrice || 'N/A'))
                const originalPriceStr = targetProductOldPrice ? ` (Original: ${targetProductOldPrice})` : ''

                productKnowledgeContext = `
Product Under Inquiry: ${targetProductData?.product_title || targetProductData?.product_name || targetProductTitle || 'Item ' + targetItemId}
Current Listed Price: ${resolvedPrice}${originalPriceStr}
${targetProductSku ? `Item SKU: ${targetProductSku}` : ''}
${targetProductUrl ? `Product URL: ${targetProductUrl}` : ''}
Specifications & Highlights:
${cleanH || 'No specific highlights listed in inventory catalog.'}
Description Summary:
${cleanD || 'No description listed in inventory catalog.'}

Verified Product Q&A Knowledge Base:
${targetProductQAs.length > 0 
    ? targetProductQAs.map(q => `• Q: "${q.question}" -> A: "${q.answer}"`).join('\n') 
    : 'No verified Q&As added for this product yet.'}
`
            }

            // 4. Conversation History (last 6 messages)
            const { data: recentMsgs } = await supabase
                .from('daraz_chat_messages')
                .select('from_account_type, content, send_time')
                .eq('session_id', sessionId)
                .order('send_time', { ascending: false })
                .limit(6)

            let historyContext = ''
            if (recentMsgs && recentMsgs.length > 0) {
                const sortedMsgs = [...recentMsgs].reverse()
                historyContext = sortedMsgs.map(m => {
                    let text = m.content
                    try {
                        const p = JSON.parse(m.content)
                        text = p.txt || m.content
                    } catch {}
                    const sender = String(m.from_account_type) === '1' ? 'Buyer (Customer)' : 'Seller (You)'
                    return `[${sender}]: ${text}`
                }).join('\n')
            }

            const agentCustomInstructions = settings.ai_agent_instructions?.trim() || DEFAULT_AI_AGENT_SYSTEM_INSTRUCTIONS

            const systemPrompt = `${agentCustomInstructions}

Store & Customer Context:
Buyer: ${session?.title || 'Customer'} (Buyer ID: ${session?.buyer_id || 'N/A'})

Buyer Order Status:
${buyerOrdersContext}
${orderDiscrepancyContext}

${productKnowledgeContext}

Recent Conversation History:
${historyContext}
[Buyer (Customer)]: ${userText}

Strict Guidelines for Response:
1. Talk like a friendly human customer service agent. Keep responses short (under 2-3 sentences).
2. If the customer asks about price or cost (e.g. "price kati xa?", "rate kati ho?", "kati parxa?", "how much is this?"), refer directly to "Current Listed Price" above and state the price clearly and politely (e.g. "Hajur, yo product ko price Rs. 1,290 ho.").
3. If customer asks about order status or delivery date, check the Buyer Order Status above.
4. ORDER DAMAGE VS SHIPPED/PENDING STATUS: If customer claims product damage/defect but the order status is currently "Shipped", "Ready to Ship", or "Pending" (not delivered), politely ask if they have already received the parcel because our system still shows it as "Shipped", and state our team will investigate. Append "[ACTION:HANDOVER_TO_HUMAN]".
5. RETURN & REFUND POLICY: If customer asks to return, refund, or claims wrong/defective item, state that Bagmati Traders carefully inspects and double-checks every parcel to dispatch the exact authentic item ordered. If damaged during courier transit, ask for unboxing photos/videos so our team can investigate and solve it. Append "[ACTION:HANDOVER_TO_HUMAN]".
6. DIRECT / OFFLINE DELIVERY OR ADDRESS & PHONE NUMBER SENT IN CHAT: If customer sends a location/address or phone number asking to send or deliver to them, politely explain that per Daraz platform rules, all orders must be placed directly by the customer on the Daraz app/website by entering their delivery location and phone number. We cannot deliver or process orders outside the Daraz platform. Instruct them to confirm their order on Daraz.
7. If customer asks about product specifications (color, size, material, warranty), check the Verified Product Q&A and Specifications above.
8. If the customer sends vague prompts or marks like "??" or greetings, respond politely acknowledging their interest in the product and ask how you can help them with their order.
9. CRITICAL RULE: If the customer asks a specific question about product features, dimensions, color, or material that is NOT answered in the Verified Product Q&A or Specifications above, DO NOT GUESS OR INVENT FACTS.
   Reply with:
   "Hamro team le yo barema check garera xittai tapailai jankari garaunecha. / Our team will check this specific detail and update you shortly."
   and append "[ACTION:HANDOVER_TO_HUMAN]" at the very end.
Response:`

            let replyText: string | null = null
            try {
                if (effectiveAi.provider === 'openai') {
                    replyText = await callOpenAiApi(effectiveAi.apiKey, systemPrompt, effectiveAi.model, false)
                } else {
                    replyText = await callGeminiApi(effectiveAi.apiKey, systemPrompt, effectiveAi.model, false)
                }
            } catch (err: any) {
                console.error(`[AutoReply] AI provider ${effectiveAi.provider} call failed:`, err.message)
            }

            if (replyText && replyText.trim()) {
                const isHandover = replyText.includes('[ACTION:HANDOVER_TO_HUMAN]')
                const cleanReply = replyText
                    .replace(/\[ACTION:HANDOVER_TO_HUMAN\]/gi, '')
                    .replace(/AI Assistant:/gi, '')
                    .trim()

                if (isHandover) {
                    const pausedUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString()
                    let handoverReason = `Customer query requires human attention: "${userText.substring(0, 50)}"`
                    if (orderDiscrepancyContext) handoverReason = `Damage claim while order in non-delivered status: "${userText.substring(0, 50)}"`
                    else if (isReturnRefundRequest) handoverReason = `Return/refund request: "${userText.substring(0, 50)}"`
                    else if (isDamageComplaint) handoverReason = `Product damage/defect claim: "${userText.substring(0, 50)}"`

                    await supabase
                        .from('daraz_chat_sessions')
                        .update({
                            is_urgent: true,
                            urgent_reason: handoverReason,
                            ai_paused_until: pausedUntil,
                            updated_at: new Date().toISOString()
                        })
                        .eq('session_id', sessionId)
                }

                console.log(`[AutoReply] AI response generated (Handover: ${isHandover}): "${cleanReply}"`)
                await sendChatMessage(storeId, sessionId, '1', cleanReply, undefined, undefined, true)
                try { revalidatePath('/dashboard/chat-ai') } catch {}
            }
        }

        // Trigger real-time AI Customer & Order Analysis update in background
        if (settings.ai_analysis_enabled) {
            generateSessionAiAnalysisAction(storeId, sessionId).catch(err => {
                console.warn(`[AutoReply] Real-time AI analysis update failed for session ${sessionId}:`, err.message)
            })
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AutoReply] Auto-reply processor encountered an error:`, errorMessage)
    }
}

// 10. Process Queue of Delayed Auto-Messages & Follow Invitations (Batch Limited for Fast Execution)
export async function processPendingDelayedMessagesAction(limit = 10) {
    try {
        const supabase = await createAdminClient()

        // First: reset any tasks stuck in 'processing' for >5 minutes
        // (handles crashed workers from previous runs)
        await supabase.rpc('reset_stuck_delayed_messages').then(({ error }) => {
            if (error) console.warn('[DelayedMessages] reset_stuck warning:', error.message)
        })

        // Atomically claim pending tasks using FOR UPDATE SKIP LOCKED.
        // This prevents the race condition where multiple concurrent callers
        // (cron + webhook + sync) process the same message twice.
        const { data: claimed, error } = await supabase
            .rpc('claim_pending_delayed_messages', { p_limit: limit })

        if (error) {
            // RPC might not exist yet (before migration runs) — fall back gracefully
            console.error('[DelayedMessages] claim RPC error (migration may be pending):', error.message)
            return { success: false, error: error.message }
        }

        const pending = claimed as any[] | null
        if (!pending || pending.length === 0) {
            return { success: true, processed: 0 }
        }

        console.log(`[DelayedMessages] Processing ${pending.length} pending automated messages...`)
        let successCount = 0

        for (const task of pending) {
            try {
                const sessionId = await openSessionByOrderId(task.store_id, task.order_id)
                if (!sessionId) {
                    throw new Error(`Could not open conversation session for order ${task.order_id}`)
                }

                // A. Send text greeting template
                if (task.txt) {
                    const res = await sendChatMessage(task.store_id, sessionId, '1', task.txt, undefined, undefined, true)
                    if (!res.success) {
                        throw new Error(res.error || 'Failed to send greeting text message')
                    }
                }

                // B. Send follow store button invitation card (Template 10010)
                const resFollow = await sendChatMessage(task.store_id, sessionId, '10010', undefined, undefined, undefined, true)
                if (!resFollow.success) {
                    throw new Error(resFollow.error || 'Failed to send follow store invitation')
                }

                await supabase
                    .from('daraz_delayed_messages')
                    .update({
                        status: 'sent',
                        session_id: sessionId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', task.id)

                successCount++
                console.log(`[DelayedMessages] ✅ Sent auto-message & follow invitation for order ${task.order_id}`)
            } catch (taskError: any) {
                console.error(`[DelayedMessages] ❌ Failed task ${task.id} for order ${task.order_id}:`, taskError.message)

                const isTemporaryError = taskError.message.includes('order not found') ||
                                         taskError.message.includes('too many requests') ||
                                         taskError.message.includes('timeout')

                let retryCount = 0
                if (task.error_message && task.error_message.includes('Retry:')) {
                    const match = task.error_message.match(/Retry:\s*(\d+)/)
                    if (match) retryCount = parseInt(match[1], 10)
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
                } else {
                    await supabase
                        .from('daraz_delayed_messages')
                        .update({
                            status: 'failed',
                            error_message: taskError.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', task.id)
                }
            }
        }

        try { revalidatePath('/dashboard/chat-ai') } catch {}
        return { success: true, processed: successCount }
    } catch (err: any) {
        console.error('[DelayedMessages] Error in processor action:', err.message)
        return { success: false, error: err.message }
    }
}
