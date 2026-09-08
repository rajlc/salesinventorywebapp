import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const redirectUri = searchParams.get('redirect_uri') || 'https://claude.ai/api/auth/callback'
    const state = searchParams.get('state') || ''
    const code = 'auth_code_' + Math.random().toString(36).substring(2, 12)

    const targetUrl = new URL(redirectUri)
    targetUrl.searchParams.set('code', code)
    if (state) {
        targetUrl.searchParams.set('state', state)
    }

    // Immediate 302 redirect back to Claude callback
    return NextResponse.redirect(targetUrl.toString())
}

export async function POST(req: NextRequest) {
    return GET(req)
}
