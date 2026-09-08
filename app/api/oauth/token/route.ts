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
        const tokenPayload = {
            access_token: 'claude_daraz_bearer_token_' + Date.now(),
            token_type: 'Bearer',
            expires_in: 315360000, // 10 years
            refresh_token: 'claude_daraz_refresh_token_' + Date.now(),
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
