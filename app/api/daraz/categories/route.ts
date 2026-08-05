import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/daraz/categories
// Returns the full Daraz category tree for Nepal
// Client caches this in sessionStorage

export async function GET(request: NextRequest) {
    try {
        // Get first active store's token (category tree is not account-specific)
        const supabase = await createAdminClient()
        const { data: stores } = await supabase
            .from('online_stores')
            .select('id')
            .eq('is_active', true)
            .limit(1)

        if (!stores || stores.length === 0) {
            return NextResponse.json({ error: 'No active Daraz stores configured' }, { status: 400 })
        }

        const accessToken = await getValidAccessToken(stores[0].id, 'order')
        const params = buildSignedParams('/category/tree/get', accessToken)

        const response = await axios.get(`${API_URL}/category/tree/get`, { params })

        if (response.data?.code !== '0' && response.data?.code !== 0) {
            return NextResponse.json(
                { error: response.data?.message || response.data?.msg || 'Failed to fetch categories' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data: response.data?.data || []
        })

    } catch (error: any) {
        console.error('[DarazCategories] Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
