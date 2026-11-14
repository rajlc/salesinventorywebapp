import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
    createConnectorTokenForUser,
    listAllActiveConnectorTokens,
    listConnectorTokensForUser,
    revokeConnectorToken
} from '@/lib/claude/connector-auth'
import { resolveListingScope } from '@/lib/daraz/listing-access'

async function getCurrentUserAndRole() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, isAdmin: false }

    const admin = await createAdminClient()
    const { data: profile } = await admin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    return { user, isAdmin: profile?.role === 'admin' }
}

// GET /api/connector-tokens?userId=optional (or ?all=true for admin)
export async function GET(req: NextRequest) {
    try {
        const { user, isAdmin } = await getCurrentUserAndRole()
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const wantAll = req.nextUrl.searchParams.get('all') === 'true'
        if (wantAll && isAdmin) {
            const tokens = await listAllActiveConnectorTokens()
            return NextResponse.json({ success: true, tokens })
        }

        const targetUserId = (isAdmin && req.nextUrl.searchParams.get('userId')) || user.id
        const [tokens, scope] = await Promise.all([
            listConnectorTokensForUser(targetUserId),
            resolveListingScope(targetUserId)
        ])

        return NextResponse.json({
            success: true,
            tokens,
            scope
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST /api/connector-tokens — Body: { userId?: string, label?: string }
export async function POST(req: NextRequest) {
    try {
        const { user, isAdmin } = await getCurrentUserAndRole()
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await req.json().catch(() => ({}))
        const targetUserId = (isAdmin && body.userId) ? String(body.userId) : user.id
        const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'AI Connector Token'

        const created = await createConnectorTokenForUser(targetUserId, label)
        const scope = await resolveListingScope(targetUserId)

        return NextResponse.json({
            success: true,
            token: created.token,
            record: created.record,
            scope
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE /api/connector-tokens?id=xxx
export async function DELETE(req: NextRequest) {
    try {
        const { user, isAdmin } = await getCurrentUserAndRole()
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const tokenId = req.nextUrl.searchParams.get('id') || ''
        if (!tokenId) {
            return NextResponse.json({ error: 'Token id is required' }, { status: 400 })
        }

        const ok = await revokeConnectorToken(tokenId, user.id, isAdmin)
        if (!ok) {
            return NextResponse.json({ error: 'Token not found or access denied' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

