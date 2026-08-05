import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const rawSku = searchParams.get('sku')

    if (!rawSku) {
        return NextResponse.json({ error: 'SKU parameter is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Call the robust database function
    const { data: matchResult, error } = await supabase
        .rpc('match_product_by_sku', { check_sku: rawSku })
        .maybeSingle() as { data: { id: number, product_id: string, product_name: string, matched_seller_sku: string, matched_seller_account: string } | null, error: any }

    if (error) {
        console.error("Error matching SKU:", error)
        return NextResponse.json({ product: null, error: error.message })
    }

    if (!matchResult) {
        return NextResponse.json({ product: null })
    }

    // RPC returns flattened structure, map it back to response format
    return NextResponse.json({
        product: {
            id: matchResult.id,
            product_id: matchResult.product_id,
            product_name: matchResult.product_name
        },
        seller_account: matchResult.matched_seller_account,
        // Optional: return which SKU matched if needed
        matched_sku: matchResult.matched_seller_sku
    })
}
