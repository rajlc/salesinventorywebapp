import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { enrichStoresWithSyncModes } from '@/lib/daraz/store-sync-config'

// GET /api/daraz/stores
// Returns the list of all active online stores (seller accounts) enriched with sync mode flags

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const onlyOrderSync = searchParams.get('onlyOrderSync') === 'true'
        const onlyChatReview = searchParams.get('onlyChatReview') === 'true'

        const supabase = await createAdminClient()

        const { data: stores, error } = await supabase
            .from('online_stores')
            .select('id, seller_account, seller_id, company_name, is_active')
            .eq('is_active', true)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        let enriched = await enrichStoresWithSyncModes(stores || [], supabase)

        if (onlyOrderSync) {
            enriched = enriched.filter(s => s.order_sync_enabled !== false)
        }

        if (onlyChatReview) {
            enriched = enriched.filter(s => s.chat_review_enabled !== false)
        }

        return NextResponse.json({
            success: true,
            data: enriched
        })

    } catch (error: any) {
        console.error('[DarazStoresAPI] Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
