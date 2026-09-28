import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface StoreMapping {
    sellerAccount: string
    sellerSku: string
}

// POST /api/daraz/products/already-pushed
// Marks a draft as manually pushed on Daraz and optionally syncs it into the products inventory list
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { draftId, skipInventory, rawName, mappings } = body

        if (!draftId) {
            return NextResponse.json({ error: 'draftId is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // 1. Fetch draft info
        const { data: draft, error: draftErr } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', draftId)
            .single()

        if (draftErr || !draft) {
            return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
        }

        // 2. If user chose to skip adding to inventory
        if (skipInventory) {
            const { error: updateErr } = await supabase
                .from('daraz_draft_listings')
                .update({
                    status: 'pushed',
                    error: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', draftId)

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                message: 'Listing marked as pushed without adding to inventory list.'
            })
        }

        // 3. Adding to inventory list
        const effectiveRawName = (rawName || draft.raw_name || '').trim()
        if (!effectiveRawName) {
            return NextResponse.json({ error: 'Product raw name is required to add to inventory' }, { status: 400 })
        }

        const validMappings: StoreMapping[] = Array.isArray(mappings)
            ? mappings
                .filter(m => m && typeof m.sellerAccount === 'string' && typeof m.sellerSku === 'string')
                .map(m => ({ sellerAccount: m.sellerAccount.trim(), sellerSku: m.sellerSku.trim() }))
                .filter(m => m.sellerAccount.length > 0 && m.sellerSku.length > 0)
            : []

        if (validMappings.length === 0) {
            return NextResponse.json({ error: 'At least one Seller Account and Seller SKU are required' }, { status: 400 })
        }

        // Check if product already exists in products table by raw name
        const { data: existing, error: existingErr } = await supabase
            .from('products')
            .select('*')
            .eq('product_name', effectiveRawName)
            .eq('is_deleted', false)
            .maybeSingle()

        if (existingErr) {
            console.error('[AlreadyPushed] Error finding existing product:', existingErr)
        }

        let targetProductId = existing?.id

        if (existing) {
            console.log(`[AlreadyPushed] Product already exists in inventory: "${effectiveRawName}". Merging new store accounts...`)
            const updatePayload: Record<string, any> = {}

            // Merge store accounts safely into empty slots (or update matching existing account's sku)
            for (const map of validMappings) {
                const targetAccount = map.sellerAccount
                const targetSku = map.sellerSku
                if (!targetAccount) continue

                let accountFoundSlot = 0
                for (let j = 1; j <= 4; j++) {
                    if (existing[`seller_account${j}`] === targetAccount) {
                        accountFoundSlot = j
                        break
                    }
                }

                if (accountFoundSlot > 0) {
                    // Update the SKU for this existing account slot
                    updatePayload[`seller_sku${accountFoundSlot}`] = targetSku
                    existing[`seller_sku${accountFoundSlot}`] = targetSku
                } else {
                    // Find first empty slot
                    for (let j = 1; j <= 4; j++) {
                        if (!existing[`seller_account${j}`]) {
                            updatePayload[`seller_account${j}`] = targetAccount
                            updatePayload[`seller_sku${j}`] = targetSku
                            existing[`seller_account${j}`] = targetAccount
                            existing[`seller_sku${j}`] = targetSku
                            break
                        }
                    }
                }
            }

            const effectiveSalesPrice = draft.special_price
            const baseUpdate: Record<string, any> = {
                updated_at: new Date().toISOString(),
                is_new_pushed: true,
                pushed_at: new Date().toISOString(),
                approval_status: 'Pending'
            }
            if (effectiveSalesPrice !== undefined && effectiveSalesPrice !== null) {
                baseUpdate.special_price = Number(effectiveSalesPrice)
            }
            if (draft.price) {
                baseUpdate.regular_price = Number(draft.price)
            }

            await supabase
                .from('products')
                .update({
                    ...updatePayload,
                    ...baseUpdate
                })
                .eq('id', existing.id)

        } else {
            console.log(`[AlreadyPushed] Inserting new product into inventory: "${effectiveRawName}"...`)
            const effectiveSalesPrice = draft.special_price
            const primaryTitle = draft.title || Object.values(draft.titles_per_store || {})[0] || effectiveRawName
            const highlightsText = Array.isArray(draft.highlights)
                ? draft.highlights.map((h: string) => `• ${h}`).join('\n')
                : (draft.highlights || '')

            const { data: newProd, error: insertErr } = await supabase
                .from('products')
                .insert({
                    product_name: effectiveRawName,
                    image_url: (draft.images && draft.images[0]) || null,
                    product_type: 'single',
                    status: 'Active',
                    seller_account1: validMappings[0]?.sellerAccount || null,
                    seller_sku1: validMappings[0]?.sellerSku || null,
                    seller_account2: validMappings[1]?.sellerAccount || null,
                    seller_sku2: validMappings[1]?.sellerSku || null,
                    seller_account3: validMappings[2]?.sellerAccount || null,
                    seller_sku3: validMappings[2]?.sellerSku || null,
                    seller_account4: validMappings[3]?.sellerAccount || null,
                    seller_sku4: validMappings[3]?.sellerSku || null,
                    import_flag: false,
                    is_deleted: false,
                    approval_status: 'Pending',
                    marketplace_sync_status: 'Done',
                    website_sync_status: 'Pending',
                    product_title: primaryTitle,
                    description: draft.description || '',
                    highlights: highlightsText,
                    regular_price: draft.price ? Number(draft.price) : 0,
                    special_price: effectiveSalesPrice !== undefined && effectiveSalesPrice !== null ? Number(effectiveSalesPrice) : null,
                    is_new_pushed: true,
                    pushed_at: new Date().toISOString()
                })
                .select('id')
                .single()

            if (insertErr) {
                console.error('[AlreadyPushed] Insert error:', insertErr)
                throw new Error(insertErr.message)
            }
            if (newProd) {
                targetProductId = newProd.id
            }
        }

        // Auto-insert wholesale price & supplier into product_wholesale_prices if provided
        if (targetProductId && draft.supplier_id && draft.wholesale_price && Number(draft.wholesale_price) > 0) {
            console.log(`[AlreadyPushed] Saving wholesale price NPR ${draft.wholesale_price} for supplier ${draft.supplier_id}...`)
            await supabase
                .from('product_wholesale_prices')
                .insert({
                    product_id: targetProductId,
                    supplier_id: draft.supplier_id,
                    wholesale_price: Number(draft.wholesale_price)
                })
        }

        // Auto-upsert sales price (market_price) & campaign price into daraz_avg_prices
        const effectiveMarketPrice = draft.special_price
        const effectiveCampPrice = draft.campaign_price || draft.attributes?.campaign_price
        if (targetProductId && (effectiveMarketPrice !== undefined || effectiveCampPrice !== undefined)) {
            const avgPayload: Record<string, any> = {
                product_id: targetProductId,
                updated_at: new Date().toISOString()
            }
            if (effectiveMarketPrice !== undefined && effectiveMarketPrice !== null && !isNaN(Number(effectiveMarketPrice))) {
                avgPayload.market_price = Number(effectiveMarketPrice)
            }
            if (effectiveCampPrice !== undefined && effectiveCampPrice !== null && !isNaN(Number(effectiveCampPrice))) {
                avgPayload.campaign_price = Number(effectiveCampPrice)
            }

            if (avgPayload.market_price !== undefined || avgPayload.campaign_price !== undefined) {
                await supabase
                    .from('daraz_avg_prices')
                    .upsert(avgPayload, { onConflict: 'product_id' })
            }
        }

        // 4. Update the draft listing to 'pushed'
        const existingAttributes = (draft.attributes && typeof draft.attributes === 'object') ? draft.attributes : {}
        await supabase
            .from('daraz_draft_listings')
            .update({
                status: 'pushed',
                error: null,
                attributes: {
                    ...existingAttributes,
                    manual_pushed_mappings: validMappings,
                    manual_pushed_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', draftId)

        return NextResponse.json({
            success: true,
            productId: targetProductId,
            message: 'Product successfully linked to inventory and marked as pushed!'
        })

    } catch (err: any) {
        console.error('[AlreadyPushed API Error]:', err)
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
    }
}
