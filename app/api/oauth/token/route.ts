import { NextRequest, NextResponse } from 'next/server'
import {
    CONNECTOR_TOKEN_PREFIX,
    verifyOAuthCode
} from '@/lib/claude/connector-auth'

export async function OPTIONS() {
    const res = new NextResponse(null, { status: 204 })
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', '*')
    return res
}

async function parseTokenRequest(req: NextRequest): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    req.nextUrl.searchParams.forEach((v, k) => {
        out[k] = v
    })
    try {
        const contentType = (req.headers.get('content-type') || '').toLowerCase()
        const rawText = await req.text()
        if (!rawText) return out
        if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
            const parsed = JSON.parse(rawText)
            if (parsed && typeof parsed === 'object') {
                for (const [k, v] of Object.entries(parsed)) {
                    if (typeof v === 'string') out[k] = v
                }
            }
        } else {
            const params = new URLSearchParams(rawText)
            params.forEach((v, k) => {
                out[k] = v
            })
        }
    } catch {
        // Ignore parse errors
    }
    return out
}

export async function POST(req: NextRequest) {
    try {
        const params = await parseTokenRequest(req)
        const code = (params.code || '').trim()
        const clientSecret = (params.client_secret || '').trim()
        const clientId = (params.client_id || '').trim()
        const refreshToken = (params.refresh_token || '').trim()

        let resolvedStaffToken: string | null = null

        // 1. Check if authorization code wraps a staff token
        const fromCode = verifyOAuthCode(code)
        if (fromCode && fromCode.startsWith(CONNECTOR_TOKEN_PREFIX)) {
            resolvedStaffToken = fromCode
        } else if (code.startsWith(CONNECTOR_TOKEN_PREFIX)) {
            resolvedStaffToken = code
        } else if (clientSecret.startsWith(CONNECTOR_TOKEN_PREFIX)) {
            resolvedStaffToken = clientSecret
        } else if (clientId.startsWith(CONNECTOR_TOKEN_PREFIX)) {
            resolvedStaffToken = clientId
        } else if (refreshToken.startsWith(CONNECTOR_TOKEN_PREFIX)) {
            resolvedStaffToken = refreshToken
        }

        const accessToken = resolvedStaffToken || ('claude_daraz_bearer_token_' + Date.now())
        const nextRefreshToken = resolvedStaffToken || ('claude_daraz_refresh_token_' + Date.now())

        const tokenPayload = {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 315360000, // 10 years
            refresh_token: nextRefreshToken,
            scope: 'tools'
        }

        const res = NextResponse.json(tokenPayload)
        res.headers.set('Content-Type', 'application/json')
        res.headers.set('Access-Control-Allow-Origin', '*')
        res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.headers.set('Access-Control-Allow-Headers', '*')
        return res
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
