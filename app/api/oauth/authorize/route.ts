import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    CONNECTOR_TOKEN_PREFIX,
    createOAuthCodeForToken,
    getOrCreateDefaultConnectorToken
} from '@/lib/claude/connector-auth'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const redirectUri = searchParams.get('redirect_uri') || 'https://claude.ai/api/auth/callback'
    const state = searchParams.get('state') || ''

    // 1. Check if a staff token was passed via query (?token=dzc_... or ?key=dzc_...) or client_id
    const explicitToken = (
        searchParams.get('token') ||
        searchParams.get('key') ||
        (searchParams.get('client_id')?.startsWith(CONNECTOR_TOKEN_PREFIX) ? searchParams.get('client_id') : '') ||
        ''
    ).trim()

    let code = 'auth_code_' + Math.random().toString(36).substring(2, 12)

    if (explicitToken && explicitToken.startsWith(CONNECTOR_TOKEN_PREFIX)) {
        code = createOAuthCodeForToken(explicitToken)
    } else {
        // 2. If the staff member is signed into the webapp in this browser, bind OAuth to their personal token automatically
        try {
            const supabase = await createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.id) {
                const staffToken = await getOrCreateDefaultConnectorToken(user.id, 'OAuth Connected AI')
                code = createOAuthCodeForToken(staffToken)
            }
        } catch {
            // Fallback to default code if no session
        }
    }

    const targetUrl = new URL(redirectUri)
    targetUrl.searchParams.set('code', code)
    if (state) {
        targetUrl.searchParams.set('state', state)
    }

    return NextResponse.redirect(targetUrl.toString())
}

export async function POST(req: NextRequest) {
    return GET(req)
}
