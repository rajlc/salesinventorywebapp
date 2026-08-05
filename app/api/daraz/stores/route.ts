import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/daraz/stores
// Returns the list of all active online stores (seller accounts)

export async function GET(request: NextRequest) {
    try {
        const supabase = await createAdminClient()
        
        const { data: stores, error } = await supabase
            .from('online_stores')
            .select('id, seller_account, seller_id')
            .eq('is_active', true)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            data: stores || []
        })

    } catch (error: any) {
        console.error('[DarazStoresAPI] Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
