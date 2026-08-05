import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/daraz/client'
import { migrateImageToDaraz } from '@/lib/daraz/image-migrate'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/daraz/images/migrate
// Body: { imageUrl: string, storeId?: string }
// Migrates a Supabase image URL to Daraz CDN (slatic.net)

export async function POST(request: NextRequest) {
    try {
        const { imageUrl, storeId } = await request.json()

        if (!imageUrl) {
            return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()
        let targetStoreId = storeId

        if (!targetStoreId) {
            // Pick the first active store if none specified
            const { data: stores } = await supabase
                .from('online_stores')
                .select('id')
                .eq('is_active', true)
                .limit(1)

            if (!stores || stores.length === 0) {
                return NextResponse.json({ error: 'No active Daraz stores configured' }, { status: 400 })
            }
            targetStoreId = stores[0].id
        }

        const accessToken = await getValidAccessToken(targetStoreId, 'order')
        const darazCdnUrl = await migrateImageToDaraz(imageUrl, accessToken)

        return NextResponse.json({
            success: true,
            url: darazCdnUrl
        })

    } catch (error: any) {
        console.error('[DarazImageMigrate] Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
