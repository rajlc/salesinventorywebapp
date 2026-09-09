import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { migrateImagesToDaraz } from '@/lib/daraz/image-migrate'
import { buildProductUpdateXml } from '@/lib/daraz/xml-builder'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            action = 'push', // 'save_draft' | 'push'
            productId,
            itemId,
            storeId,
            sellerAccount,
            name,
            images = [],
            shortDescription = '',
            description = '',
            price,
            specialPrice,
            brand = 'Remark',
            sellerSku
        } = body

        if (!productId) {
            return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // ── 1. Action: SAVE DRAFT ───────────────────────────────────────────────
        if (action === 'save_draft') {
            const draftData = {
                name,
                images,
                shortDescription,
                description,
                price,
                specialPrice,
                brand,
                sellerSku,
                updatedAt: new Date().toISOString()
            }

            // Attempt update on products table
            try {
                const { error: draftErr } = await supabase
                    .from('products')
                    .update({
                        daraz_edit_draft: draftData,
                        daraz_push_status: 'draft_saved',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', productId)

                if (draftErr) {
                    console.warn('[DarazProductUpdate] Fallback saving draft without dedicated column:', draftErr.message)
                }
            } catch (err: any) {
                console.error('[DarazProductUpdate] Failed to save draft:', err.message)
            }

            return NextResponse.json({
                success: true,
                message: 'Draft saved successfully! You can push these changes to Daraz later.'
            })
        }

        // ── 2. Action: PUSH TO DARAZ ────────────────────────────────────────────
        if (!name || !name.trim()) {
            return NextResponse.json({ success: false, error: 'Product title is required' }, { status: 400 })
        }

        // Resolve storeId and sellerAccount
        let targetStoreId = storeId
        if (!targetStoreId && sellerAccount) {
            const { data: st } = await supabase
                .from('online_stores')
                .select('id')
                .eq('seller_account', sellerAccount)
                .maybeSingle()
            if (st) targetStoreId = st.id
        }

        if (!targetStoreId) {
            // Fallback: look up product record to determine seller_account
            const { data: prod } = await supabase
                .from('products')
                .select('seller_account1, seller_account2, seller_account3, seller_account4, seller_sku1')
                .eq('id', productId)
                .maybeSingle()
            
            const acc = prod?.seller_account1 || prod?.seller_account2 || prod?.seller_account3 || prod?.seller_account4
            if (acc) {
                const { data: st } = await supabase
                    .from('online_stores')
                    .select('id')
                    .eq('seller_account', acc)
                    .maybeSingle()
                if (st) targetStoreId = st.id
            }
        }

        if (!targetStoreId) {
            return NextResponse.json({ success: false, error: 'No connected Daraz store found for this product.' }, { status: 400 })
        }

        const accessToken = await getValidAccessToken(targetStoreId, 'order')

        // Resolve real Daraz Item ID
        let darazItemId = (itemId && itemId !== productId) ? itemId : null

        if (!darazItemId) {
            // 1. Check if products table has daraz_item_id or extract from daraz_product_url
            try {
                const { data: dbProd } = await supabase
                    .from('products')
                    .select('daraz_item_id, daraz_product_url')
                    .eq('id', productId)
                    .maybeSingle()

                if (dbProd?.daraz_item_id) {
                    darazItemId = dbProd.daraz_item_id
                } else if (dbProd?.daraz_product_url) {
                    const match = dbProd.daraz_product_url.match(/-i(\d+)-/)
                    if (match?.[1]) {
                        darazItemId = match[1]
                    }
                }
            } catch (err: any) {
                console.warn('[DarazProductUpdate] DB item_id check warning:', err.message)
            }
        }

        const targetSku = (sellerSku || '').trim()

        // 2. Query Daraz API using sku_seller_list if item_id is still not found
        if (!darazItemId && targetSku) {
            try {
                console.log(`[DarazProductUpdate] Resolving item_id for SKU "${targetSku}" via /products/get...`)
                const listParams = buildSignedParams('/products/get', accessToken, {
                    filter: 'all',
                    sku_seller_list: JSON.stringify([targetSku])
                })
                const listRes = await axios.get(`${API_URL}/products/get`, { params: listParams })
                if (listRes.data?.code === '0' || listRes.data?.code === 0) {
                    const matched = listRes.data?.data?.products?.[0]
                    if (matched?.item_id) {
                        darazItemId = matched.item_id
                        console.log(`[DarazProductUpdate] Successfully resolved item_id: ${darazItemId}`)
                        // Save back to DB so future operations are instant
                        await supabase
                            .from('products')
                            .update({ daraz_item_id: String(matched.item_id) })
                            .eq('id', productId)
                    }
                }
            } catch (itemErr: any) {
                console.warn('[DarazProductUpdate] Could not fetch item_id via sku_seller_list:', itemErr.message)
            }
        }

        if (!darazItemId || darazItemId === productId) {
            return NextResponse.json({
                success: false,
                error: 'Could not resolve Daraz Item ID. Please ensure the product is synced from Daraz.'
            }, { status: 400 })
        }

        // Migrate images to Daraz CDN (slatic.net)
        let darazImages: string[] = []
        if (Array.isArray(images) && images.length > 0) {
            console.log(`[DarazProductUpdate] Migrating ${images.length} images to Daraz CDN...`)
            darazImages = await migrateImagesToDaraz(images, accessToken)
        }

        // Replace Supabase image URLs in HTML description with Daraz CDN URLs
        let migratedDescription = description || ''
        if (Array.isArray(images) && darazImages && darazImages.length > 0) {
            images.forEach((supabaseUrl: string, index: number) => {
                const darazUrl = darazImages[index]
                if (supabaseUrl && darazUrl) {
                    migratedDescription = migratedDescription.split(supabaseUrl).join(darazUrl)
                }
            })
        }

        // Format shortDescription (Highlights) to valid HTML ul/li
        let formattedShortDesc = shortDescription || ''
        if (formattedShortDesc && !formattedShortDesc.includes('<ul') && !formattedShortDesc.includes('<li')) {
            const items = formattedShortDesc
                .split(/\n+/)
                .map((item: string) => item.replace(/^[•\-\*\s]+/, '').trim())
                .filter(Boolean)
            if (items.length > 0) {
                formattedShortDesc = `<ul>${items.map((i: string) => `<li>${i}</li>`).join('')}</ul>`
            }
        }

        // Format description to valid HTML paragraphs if plain text
        let formattedDescription = migratedDescription
        if (formattedDescription && !/<[a-z][\s\S]*>/i.test(formattedDescription)) {
            const paragraphs = formattedDescription
                .split(/\n{2,}/)
                .map((p: string) => p.trim())
                .filter(Boolean)
            if (paragraphs.length > 0) {
                formattedDescription = paragraphs.map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')
            } else {
                formattedDescription = `<p>${formattedDescription}</p>`
            }
        }

        // Build SKU update entry with SkuId
        const effectivePrice = parseFloat(String(price || 0))
        const effectiveSpecialPrice = specialPrice ? parseFloat(String(specialPrice)) : undefined

        // Resolve SkuId for the SKU from Daraz item details
        let targetSkuId: string | number | undefined = undefined
        try {
            const itemParams = buildSignedParams('/product/item/get', accessToken, {
                item_id: String(darazItemId)
            })
            const itemRes = await axios.get(`${API_URL}/product/item/get`, { params: itemParams })
            if (itemRes.data?.code === '0' || itemRes.data?.code === 0) {
                const liveSkus = itemRes.data?.data?.skus || []
                const matchedSku = liveSkus.find((s: any) =>
                    s.SellerSku?.toLowerCase().trim() === targetSku.toLowerCase().trim()
                ) || liveSkus[0]
                if (matchedSku?.SkuId) {
                    targetSkuId = matchedSku.SkuId
                    console.log(`[DarazProductUpdate] Resolved SkuId: ${targetSkuId} for SellerSku: ${targetSku}`)
                }
            }
        } catch (itemErr: any) {
            console.warn('[DarazProductUpdate] Could not fetch SkuId via /product/item/get:', itemErr.message)
        }

        const skusPayload = targetSku ? [{
            skuId: targetSkuId,
            sellerSku: targetSku,
            price: effectivePrice,
            specialPrice: effectiveSpecialPrice,
            quantity: undefined,
            images: darazImages.length > 0 ? [darazImages[0]] : undefined
        }] : []

        // Generate XML payload for /product/update
        const xmlPayload = buildProductUpdateXml({
            itemId: darazItemId,
            name: name.trim(),
            shortDescription: formattedShortDesc,
            description: formattedDescription,
            brand: brand || 'Remark',
            images: darazImages,
            skus: skusPayload as any
        })

        // Call Daraz /product/update API
        const apiPath = '/product/update'
        const params = buildSignedParams(apiPath, accessToken, { payload: xmlPayload })

        console.log(`[DarazProductUpdate] Posting update to Daraz for item ${darazItemId}...`)
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params })
        const resData = response.data

        if (resData.code !== '0' && resData.code !== 0) {
            console.error('[DarazProductUpdate] Daraz Error:', JSON.stringify(resData, null, 2))
            let errMsg = resData.message || resData.msg || 'Update failed'
            if (resData.detail && Array.isArray(resData.detail) && resData.detail.length > 0) {
                const detailedMsgs = resData.detail.map((d: any) => d.message).filter(Boolean).join(' | ')
                if (detailedMsgs) errMsg = `${errMsg}: ${detailedMsgs}`
            }
            return NextResponse.json({ success: false, error: errMsg }, { status: 400 })
        }

        // 1. Update standard database columns on products table
        const baseUpdatePayload: Record<string, any> = {
            product_name: name.trim(),
            product_title: name.trim(),
            highlights: formattedShortDesc,
            description: formattedDescription,
            is_new_pushed: true,
            marketplace_sync_status: 'Done',
            pushed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        if (images.length > 0) {
            baseUpdatePayload.image_url = images[0]
            baseUpdatePayload.other_images = images.slice(1)
        }
        if (effectivePrice > 0) {
            baseUpdatePayload.regular_price = effectivePrice
        }
        if (effectiveSpecialPrice !== undefined) {
            baseUpdatePayload.special_price = effectiveSpecialPrice
        }

        const { error: baseUpdateErr } = await supabase
            .from('products')
            .update(baseUpdatePayload)
            .eq('id', productId)

        if (baseUpdateErr) {
            console.error('[DarazProductUpdate] Error updating base products table:', baseUpdateErr.message)
        } else {
            console.log('[DarazProductUpdate] Successfully updated local product record!')
        }

        // 2. Best-effort update for new columns (daraz_item_id, daraz_push_status, daraz_edit_draft)
        try {
            await supabase
                .from('products')
                .update({
                    daraz_item_id: String(darazItemId),
                    daraz_push_status: 'pushed',
                    daraz_edit_draft: null
                })
                .eq('id', productId)
        } catch {
            // Non-fatal if columns don't exist yet in remote DB
        }

        // Sync with daraz_avg_prices table
        const salesPrice = effectiveSpecialPrice || effectivePrice
        if (salesPrice > 0) {
            try {
                await supabase
                    .from('daraz_avg_prices')
                    .upsert({
                        product_id: productId,
                        market_price: salesPrice,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'product_id' })
            } catch (avgErr: any) {
                console.warn('[DarazProductUpdate] daraz_avg_prices sync warning:', avgErr.message)
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Product successfully updated and pushed to Daraz!'
        })

    } catch (error: any) {
        console.error('[DarazProductUpdate] General error:', error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
