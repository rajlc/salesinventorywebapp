import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface PushTokenItem {
    token: string
    platform?: string
    deviceName?: string
    updatedAt: string
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { pushToken, platform, deviceName } = body

        if (!pushToken || typeof pushToken !== 'string') {
            return NextResponse.json({ error: 'pushToken is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // Fetch existing tokens from app_settings
        const { data: settingRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'mobile_push_tokens')
            .maybeSingle()

        const existingTokens: PushTokenItem[] = settingRow?.value?.tokens || []

        // Remove old entry for same token if exists
        const filteredTokens = existingTokens.filter(t => t.token !== pushToken)

        // Add or update entry
        filteredTokens.push({
            token: pushToken,
            platform: platform || 'android',
            deviceName: deviceName || 'Mobile Device',
            updatedAt: new Date().toISOString(),
        })

        // Save back to app_settings
        const { error: saveErr } = await supabase
            .from('app_settings')
            .upsert({
                key: 'mobile_push_tokens',
                value: { tokens: filteredTokens },
                updated_at: new Date().toISOString(),
            })

        if (saveErr) {
            console.error('[API-RegisterToken] Save error:', saveErr.message)
            return NextResponse.json({ error: saveErr.message }, { status: 500 })
        }

        console.log(`[API-RegisterToken] Successfully registered push token: ${pushToken.slice(0, 25)}... (Total: ${filteredTokens.length})`)

        return NextResponse.json({
            success: true,
            totalDevices: filteredTokens.length,
            message: 'Push token registered successfully'
        })

    } catch (err: any) {
        console.error('[API-RegisterToken] Unexpected error:', err.message)
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
    }
}
