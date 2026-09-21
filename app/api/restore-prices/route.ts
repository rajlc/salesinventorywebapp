import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const items: Array<{
            name?: string
            product_id?: string
            daraz_price?: number | null
            campaign_price?: number | null
            mega_campaign_price?: number | null
        }> = Array.isArray(body) ? body : body.items || body.products || []

        if (!items || items.length === 0) {
            return NextResponse.json({ success: false, message: 'No items provided' }, { status: 400 })
        }

        const supabase = await createClient()

        // Get all products to match by name or id
        const { data: allProds, error: pErr } = await supabase
            .from('products')
            .select('id, product_name')

        if (pErr || !allProds) {
            return NextResponse.json({ success: false, message: pErr?.message || 'Failed to fetch products' }, { status: 500 })
        }

        const nameMap = new Map<string, string>()
        allProds.forEach(p => {
            if (p.product_name) {
                nameMap.set(p.product_name.trim().toLowerCase(), p.id)
            }
        })

        let restoredCount = 0
        const batchUpserts: Array<{
            product_id: string
            market_price?: number | null
            campaign_price?: number | null
            mega_campaign_price?: number | null
            updated_at: string
        }> = []

        const now = new Date().toISOString()

        for (const item of items) {
            let pid = item.product_id
            if (!pid && item.name) {
                pid = nameMap.get(item.name.trim().toLowerCase())
                if (!pid) {
                    // Try partial match
                    const cleanName = item.name.trim().toLowerCase()
                    for (const [pName, pId] of nameMap.entries()) {
                        if (pName.includes(cleanName) || cleanName.includes(pName)) {
                            pid = pId
                            break
                        }
                    }
                }
            }

            if (pid) {
                batchUpserts.push({
                    product_id: pid,
                    market_price: item.daraz_price !== undefined ? item.daraz_price : null,
                    campaign_price: item.campaign_price !== undefined ? item.campaign_price : null,
                    mega_campaign_price: item.mega_campaign_price !== undefined ? item.mega_campaign_price : null,
                    updated_at: now
                })
                restoredCount++
            }
        }

        // Upsert in batches of 100
        for (let i = 0; i < batchUpserts.length; i += 100) {
            const chunk = batchUpserts.slice(i, i + 100)
            const { error: upErr } = await supabase
                .from('daraz_avg_prices')
                .upsert(chunk, { onConflict: 'product_id' })

            if (upErr) {
                console.error('[restore-prices] upsert chunk error:', upErr)
            }
        }

        try { revalidateTag('daraz-avg-prices') } catch (_) {}
        revalidatePath('/dashboard/sales/daraz/average-sales-price')

        return NextResponse.json({
            success: true,
            restoredCount,
            totalProvided: items.length
        })

    } catch (err: any) {
        console.error('[restore-prices] error:', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}
