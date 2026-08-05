import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDarazReviews } from '@/features/reviews/actions/review-actions'

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const supabase = await createAdminClient()

    try {
        console.log('[Cron-Reviews] Starting automatic reviews sync for all stores...')

        // Fetch all stores
        const { data: stores, error } = await supabase
            .from('online_stores')
            .select('id, seller_account')

        if (error) {
            throw new Error(`Failed to fetch stores: ${error.message}`)
        }

        console.log(`[Cron-Reviews] Found ${stores?.length || 0} stores to process.`)

        const results = []

        if (stores && stores.length > 0) {
            for (const store of stores) {
                try {
                    console.log(`[Cron-Reviews] Syncing reviews for store: ${store.seller_account} (${store.id})...`)
                    const res = await syncDarazReviews(store.id)
                    results.push({
                        store_id: store.id,
                        seller_account: store.seller_account,
                        status: res.success ? 'success' : 'failed',
                        count: res.success ? res.count : 0,
                        error: res.success ? null : res.error
                    })
                } catch (storeError: any) {
                    console.error(`[Cron-Reviews] Error syncing store ${store.seller_account}:`, storeError.message)
                    results.push({
                        store_id: store.id,
                        seller_account: store.seller_account,
                        status: 'failed',
                        count: 0,
                        error: storeError.message
                    })
                }
            }
        }

        return NextResponse.json({
            success: true,
            processed_stores: results.length,
            details: results,
            elapsed_ms: Date.now() - startTime
        })

    } catch (err: any) {
        console.error('[Cron-Reviews] Critical error in reviews sync cron:', err.message)
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 })
    }
}
