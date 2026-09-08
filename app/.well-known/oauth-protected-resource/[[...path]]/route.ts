import { NextRequest, NextResponse } from 'next/server'

function getBaseUrl(req: NextRequest): string {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    if (host) return `${proto}://${host}`
    return req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function OPTIONS() {
    const res = new NextResponse(null, { status: 204 })
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', '*')
    return res
}

export async function GET(req: NextRequest) {
    const baseUrl = getBaseUrl(req)

    const metadata = {
        resource: `${baseUrl}/api/claude-connector`,
        authorization_servers: [baseUrl],
        scopes_supported: ['tools']
    }

    const res = NextResponse.json(metadata)
    res.headers.set('Content-Type', 'application/json')
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', '*')
    return res
}
