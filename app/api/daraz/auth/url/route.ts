
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('storeId')

    if (!storeId) {
        return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const appType = searchParams.get('appType') || 'order'
    const appKey = appType === 'chat'
        ? process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim()
        : process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()

    const redirectUri = process.env.DARAZ_CALLBACK_URL?.trim() || `${process.env.NEXT_PUBLIC_APP_URL?.trim()}/api/daraz/auth/callback`

    if (!appKey) {
        return NextResponse.json({ error: `Daraz App Key for ${appType} is not configured` }, { status: 500 })
    }

    // State parameter passes the storeId and appType to the callback so we know which store/app to link the token to
    const state = `${storeId}_${appType}`

    // Construct the OAuth URL
    // Standard Daraz OAuth URL: https://api.daraz.com.np/oauth/authorize
    const authUrl = `https://api.daraz.com.np/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}&state=${state}`

    return NextResponse.json({ url: authUrl })
}
