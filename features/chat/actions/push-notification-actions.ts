import { createAdminClient } from '@/lib/supabase/server'

interface PushTokenItem {
    token: string
    platform?: string
    deviceName?: string
    updatedAt: string
}

// In-memory cooldown cache to prevent sending duplicate remote pushes within 15 minutes
const lastPushedMap = new Map<string, { reason: string; timestamp: number }>()

/**
 * Dispatches a high-priority Expo Remote Push Notification directly to all registered
 * mobile devices even when the mobile app is completely closed or killed.
 */
export async function sendUrgentPushNotification(
    storeId: string,
    sessionId: string,
    customerTitle: string,
    urgentReason: string
) {
    try {
        const cleanReason = (urgentReason || 'Customer inquiry requires urgent attention').trim()
        const cleanTitle = (customerTitle || 'Daraz Customer').trim()

        // 1. Check in-memory cooldown (15 minutes for exact same session and reason)
        const now = Date.now()
        const lastPushed = lastPushedMap.get(sessionId)
        if (lastPushed) {
            const sameReason = lastPushed.reason === cleanReason
            const isRecent = (now - lastPushed.timestamp) < 15 * 60 * 1000 // 15 mins
            if (sameReason && isRecent) {
                console.log(`[PushNotification] Skipping duplicate remote push for session ${sessionId} (cooldown active)`)
                return { success: true, skipped: true }
            }
        }

        const supabase = await createAdminClient()

        // 2. Fetch registered mobile push tokens from app_settings
        const { data: settingRow, error: fetchErr } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'mobile_push_tokens')
            .maybeSingle()

        if (fetchErr) {
            console.error('[PushNotification] Error fetching mobile push tokens:', fetchErr.message)
            return { success: false, error: fetchErr.message }
        }

        const rawTokens: PushTokenItem[] = settingRow?.value?.tokens || []
        const validTokens = rawTokens.filter(t => typeof t.token === 'string' && t.token.startsWith('ExponentPushToken'))

        if (validTokens.length === 0) {
            console.log('[PushNotification] No registered mobile push tokens found in app_settings.')
            return { success: true, count: 0 }
        }

        // Record cooldown
        lastPushedMap.set(sessionId, { reason: cleanReason, timestamp: now })

        // 3. Format message payloads for Expo Push API
        const messages = validTokens.map(item => ({
            to: item.token,
            title: `Urgent Message: ${cleanTitle}`,
            body: `Urgent Messages : ${cleanReason}`,
            data: {
                sessionId,
                storeId,
                title: cleanTitle,
            },
            sound: 'default',
            priority: 'high',
            channelId: 'urgent-daraz-chat',
            categoryId: 'urgent-daraz-chat',
        }))

        console.log(`[PushNotification] Dispatching remote push to ${messages.length} device(s) for customer "${cleanTitle}"...`)

        // 4. Send HTTP POST to Expo's Push Gateway
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(messages),
        })

        const resJson = await response.json().catch(() => ({}))

        if (!response.ok) {
            console.error('[PushNotification] Expo Push API Error:', resJson)
            return { success: false, error: resJson?.errors?.[0]?.message || 'Expo push failed' }
        }

        // 5. Clean up any invalid or unregistered device tokens
        const tickets = Array.isArray(resJson.data) ? resJson.data : [resJson.data]
        const invalidTokens: string[] = []

        tickets.forEach((ticket: any, index: number) => {
            if (ticket?.status === 'error') {
                console.warn(`[PushNotification] Ticket error for device:`, ticket?.message, ticket?.details)
                if (ticket?.details?.error === 'DeviceNotRegistered') {
                    invalidTokens.push(validTokens[index].token)
                }
            }
        })

        if (invalidTokens.length > 0) {
            const updatedTokens = rawTokens.filter(t => !invalidTokens.includes(t.token))
            await supabase
                .from('app_settings')
                .update({
                    value: { tokens: updatedTokens },
                    updated_at: new Date().toISOString(),
                })
                .eq('key', 'mobile_push_tokens')
            console.log(`[PushNotification] Removed ${invalidTokens.length} unregistered push token(s)`)
        }

        console.log(`[PushNotification] Successfully dispatched push notification to Expo for session ${sessionId}`)
        return { success: true, count: validTokens.length }

    } catch (err: any) {
        console.error('[PushNotification] Unexpected error in sendUrgentPushNotification:', err.message)
        return { success: false, error: err.message }
    }
}
