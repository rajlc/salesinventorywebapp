import { NextResponse } from 'next/server'
import { pushStockToDaraz } from '@/features/sales/actions/avg-price-actions'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { updates } = body // Expected: { updates: [{ sku, store_id, quantity }] }

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ success: false, error: 'Invalid updates format' }, { status: 400 })
        }

        const supabase = await createAdminClient()
        const results = await pushStockToDaraz(updates, undefined, supabase)
        
        return NextResponse.json(results)
    } catch (error: any) {
        console.error('API Error pushing stock to Daraz:', error)
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to push stock to Daraz' 
        }, { status: 500 })
    }
}
