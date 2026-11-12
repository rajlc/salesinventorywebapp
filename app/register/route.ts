import { NextRequest, NextResponse } from 'next/server'

export async function OPTIONS() {
    const res = new NextResponse(null, { status: 204 })
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', '*')
    return res
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))

        const client_id = 'claude_daraz_client_' + Math.random().toString(36).substring(2, 10)
        const client_secret = 'claude_daraz_secret_' + Math.random().toString(36).substring(2, 14)

        const requestedRedirectUris = Array.isArray(body?.redirect_uris) && body.redirect_uris.length > 0
            ? body.redirect_uris
            : (typeof body?.redirect_uri === 'string' ? [body.redirect_uri] : ['https://claude.ai/api/auth/callback'])

        const clientData = {
            client_id,
            client_secret,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            client_secret_expires_at: 0,
            client_name: body.client_name || 'MCP Custom Connector',
            redirect_uris: requestedRedirectUris,
            grant_types: Array.isArray(body?.grant_types) && body.grant_types.length > 0
                ? body.grant_types
                : ['authorization_code', 'refresh_token'],
            response_types: Array.isArray(body?.response_types) && body.response_types.length > 0
                ? body.response_types
                : ['code'],
            token_endpoint_auth_method: body.token_endpoint_auth_method || 'client_secret_post'
        }

        const res = NextResponse.json(clientData, { status: 201 })
        res.headers.set('Content-Type', 'application/json')
        res.headers.set('Access-Control-Allow-Origin', '*')
        res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.headers.set('Access-Control-Allow-Headers', '*')
        return res
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
