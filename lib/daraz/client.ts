import crypto from 'crypto'
import axios from 'axios'
import { createAdminClient } from '@/lib/supabase/server'

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'
const APP_KEY = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim() || ''
const APP_SECRET = process.env.DARAZ_APP_SECRET?.trim() || ''

// HMAC-SHA256 request signing (Daraz Open Platform standard)
export function signRequest(
    apiName: string,
    params: Record<string, any>,
    appSecret: string = APP_SECRET
): string {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => { str += key + params[key] })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// Build signed base params for any Daraz API call
export function buildSignedParams(
    apiPath: string,
    accessToken: string,
    extra: Record<string, any> = {}
): Record<string, any> {
    const params: Record<string, any> = {
        app_key: APP_KEY,
        access_token: accessToken,
        timestamp: Date.now().toString(),
        sign_method: 'sha256',
        ...extra,
    }
    params.sign = signRequest(apiPath, params, APP_SECRET)
    return params
}

// Auto-refreshing access token getter
// Checks expiry and refreshes using refresh_token if needed
export async function getValidAccessToken(
    storeId: string,
    appType: string = 'order'
): Promise<string> {
    const supabase = await createAdminClient()

    const { data: tokenData, error } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', appType)
        .maybeSingle()

    if (error || !tokenData) {
        throw new Error(`No Daraz token found for store ${storeId} (${appType}). Please reconnect your Daraz account.`)
    }

    // Check if token is near expiry (within 2 days = 172800 seconds)
    const updatedAt = new Date(tokenData.updated_at).getTime()
    const expiresIn = tokenData.expires_in || 1296000 // default 15 days
    const expiryTime = updatedAt + expiresIn * 1000
    const twodays = 2 * 24 * 60 * 60 * 1000
    const isNearExpiry = Date.now() > (expiryTime - twodays)

    if (!isNearExpiry) {
        return tokenData.access_token
    }

    // Token is expired or near expiry — refresh it
    if (!tokenData.refresh_token) {
        throw new Error(`Daraz access token expired for store ${storeId}. Please reconnect your Daraz account.`)
    }

    try {
        const refreshParams: Record<string, any> = {
            app_key: APP_KEY,
            refresh_token: tokenData.refresh_token,
            timestamp: Date.now().toString(),
            sign_method: 'sha256',
        }
        const apiPath = '/auth/token/refresh'
        refreshParams.sign = signRequest(apiPath, refreshParams, APP_SECRET)

        const response = await axios.post(`${API_URL}${apiPath}`, null, { params: refreshParams })
        const data = response.data

        if (!data.access_token) {
            throw new Error(data.message || data.msg || 'Token refresh failed')
        }

        // Save refreshed token
        await supabase
            .from('daraz_api_tokens')
            .update({
                access_token: data.access_token,
                refresh_token: data.refresh_token || tokenData.refresh_token,
                expires_in: data.expires_in || expiresIn,
                updated_at: new Date().toISOString(),
            })
            .eq('store_id', storeId)
            .eq('app_type', appType)

        console.log(`[DarazClient] Token refreshed for store ${storeId}`)
        return data.access_token

    } catch (refreshErr: any) {
        console.error(`[DarazClient] Token refresh failed for store ${storeId}:`, refreshErr.message)
        throw new Error(`Daraz token refresh failed: ${refreshErr.message}. Please reconnect your account.`)
    }
}

// Fetch all active stores with their tokens (for multi-account operations)
export async function getActiveStoresWithTokens(appType: string = 'order') {
    const supabase = await createAdminClient()

    const { data: stores, error } = await supabase
        .from('online_stores')
        .select('id, seller_account, seller_id')
        .eq('is_active', true)

    if (error || !stores) return []

    const results = []
    for (const store of stores) {
        try {
            const accessToken = await getValidAccessToken(store.id, appType)
            results.push({ ...store, accessToken })
        } catch {
            console.warn(`[DarazClient] Skipping store ${store.seller_account}: no valid token`)
        }
    }
    return results
}

export { API_URL, APP_KEY, APP_SECRET }
