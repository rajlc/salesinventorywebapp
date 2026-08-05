import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import axios from 'axios'

// Helper to sign requests
// Per Daraz API spec: 'sign' and 'sign_method' must be EXCLUDED from the signature string.
// Including sign_method produces a wrong hash → Daraz rejects it as "Unregistered API key".
function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const EXCLUDED_KEYS = new Set(['sign', 'sign_method'])
    const keys = Object.keys(params).filter(k => !EXCLUDED_KEYS.has(k)).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') || ''

    // State is formatted as "{storeId}_{appType}" e.g. "1891e873-ee8d-4df4-b12e-0888ccdcd1db_chat"
    // UUIDs use dashes, so the LAST underscore separates the UUID from appType
    const lastUnderscoreIdx = state.lastIndexOf('_')
    const storeId = lastUnderscoreIdx > 0 ? state.substring(0, lastUnderscoreIdx) : state
    const appType = lastUnderscoreIdx > 0 ? state.substring(lastUnderscoreIdx + 1) : 'order'

    console.log(`[AuthCallback] Received — storeId: "${storeId}", appType: "${appType}"`)

    if (!code) {
        return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 })
    }

    const appKey = appType === 'chat'
        ? process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim()
        : process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = appType === 'chat'
        ? process.env.DARAZ_CHAT_APP_SECRET?.trim()
        : process.env.DARAZ_APP_SECRET?.trim()

    if (!appKey || !appSecret) {
        console.error(`[AuthCallback] Missing env vars for appType="${appType}": appKey=${!!appKey}, appSecret=${!!appSecret}`)
        return NextResponse.json({ error: `Daraz API configuration missing for ${appType} app` }, { status: 500 })
    }

    try {
        // Exchange authorization code for access token
        const timestamp = new Date().getTime()
        const params: Record<string, any> = {
            code: code,
            app_key: appKey,
            sign_method: 'sha256',
            timestamp: timestamp
        }

        const apiPath = '/auth/token/create'
        const authApiUrl = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[AuthCallback] Requesting token from Daraz for ${appType} app (key: ${appKey})...`)

        const response = await axios.post(`${authApiUrl}${apiPath}`, null, { params })
        const data = response.data

        if (data.access_token) {
            // IMPORTANT: Must use Admin client (service role key) here.
            // The OAuth redirect from Daraz arrives with NO user session cookie,
            // so the regular session-based createClient() has no permissions and RLS blocks the upsert.
            const { createAdminClient } = await import('@/lib/supabase/server')
            const supabase = await createAdminClient()

            const { error } = await supabase
                .from('daraz_api_tokens')
                .upsert({
                    store_id: storeId,
                    app_type: appType,
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_in: data.expires_in,
                    token_type: data.token_type,
                    account: data.account,
                    country: data.country,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'store_id,app_type' })

            if (error) {
                console.error('[AuthCallback] Database upsert error:', JSON.stringify(error))
                return NextResponse.json({
                    error: 'Failed to save token',
                    detail: error.message,
                    code: error.code
                }, { status: 500 })
            }

            console.log(`[AuthCallback] ✅ Token saved for store "${storeId}" (${appType})`)

            // Redirect back to the app.
            // Prefer NEXT_PUBLIC_APP_URL so it works the same on Render, ngrok, and localhost.
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin
            const redirectPath = appType === 'chat'
                ? '/dashboard/chat-ai?status=success'
                : '/dashboard/sales/daraz/order-sync?status=success'
            return NextResponse.redirect(`${baseUrl}${redirectPath}`)
        } else {
            console.error('[AuthCallback] Daraz token exchange failed — response:', data)
            return NextResponse.json({ error: 'Failed to obtain access token', details: data }, { status: 500 })
        }

    } catch (error: any) {
        console.error('[AuthCallback] Exception:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Authentication process failed',
            details: error.response?.data?.message || error.message
        }, { status: 500 })
    }
}
