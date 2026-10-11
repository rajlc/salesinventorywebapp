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

    if (!appKey) {
        return NextResponse.json({ error: `Daraz App Key for ${appType} is not configured` }, { status: 500 })
    }

    // Determine the base origin dynamically:
    // 1. Explicit `origin` passed in query param from browser (e.g. window.location.origin)
    // 2. Incoming request headers (x-forwarded-host, host)
    // 3. Fallbacks with stale-domain protection (avoid old vercel.app when deployed on onrender.com)
    const clientOrigin = searchParams.get('origin')?.trim()

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const detectedOrigin = `${proto}://${host}`

    const activeOrigin = clientOrigin || detectedOrigin

    let redirectUri = `${activeOrigin}/api/daraz/auth/callback`

    if (process.env.DARAZ_CALLBACK_URL?.trim()) {
        const envCb = process.env.DARAZ_CALLBACK_URL.trim()
        if (activeOrigin.includes('onrender.com') && envCb.includes('vercel.app')) {
            console.warn('[DarazAuthUrl] Ignoring stale Vercel DARAZ_CALLBACK_URL in Render environment:', envCb)
        } else {
            redirectUri = envCb
        }
    } else if (process.env.NEXT_PUBLIC_APP_URL?.trim() && !clientOrigin) {
        const envAppUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
        if (activeOrigin.includes('onrender.com') && envAppUrl.includes('vercel.app')) {
            console.warn('[DarazAuthUrl] Ignoring stale Vercel NEXT_PUBLIC_APP_URL in Render environment:', envAppUrl)
        } else {
            redirectUri = `${envAppUrl}/api/daraz/auth/callback`
        }
    }

    // State parameter passes the storeId and appType to the callback so we know which store/app to link the token to
    const state = `${storeId}_${appType}`

    // Construct the OAuth URL
    // Standard Daraz OAuth URL: https://api.daraz.com.np/oauth/authorize
    const authUrl = `https://api.daraz.com.np/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}&state=${state}`

    console.log(`[DarazAuthUrl] Generated Auth URL for store="${storeId}", appType="${appType}", redirectUri="${redirectUri}"`)

    return NextResponse.json({ url: authUrl, redirectUri })
}
