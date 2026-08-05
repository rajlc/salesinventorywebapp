import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { migrateImagesToDaraz } from '@/lib/daraz/image-migrate'
import { buildProductCreateXml, DarazProductPayload, DarazSkuVariant } from '@/lib/daraz/xml-builder'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/daraz/products/create
// Body: {
//   storeIds: string[],
//   primaryCategory: number,
//   name: string,
//   shortDescription: string, // highlights
//   description: string,
//   brand: string,
//   attributes: Record<string, string>,
//   skus: Array<{
//     sellerSku?: string,
//     price: number,
//     specialPrice?: number,
//     quantity: number,
//     packageWeight: number,
//     packageLength: number,
//     packageWidth: number,
//     packageHeight: number,
//     packageContent?: string,
//     images: string[] // Supabase URLs
//   }>,
//   images: string[] // Supabase URLs
// }

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            storeIds,
            primaryCategory,
            name,
            rawName,
            shortDescription,
            description,
            brand,
            attributes,
            skus,
            images,
            supplier_id,
            supplierId,
            wholesale_price,
            wholesalePrice
        } = body

        if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
            return NextResponse.json({ error: 'At least one storeId is required' }, { status: 400 })
        }

        if (!primaryCategory) {
            return NextResponse.json({ error: 'primaryCategory is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()
        const results = []

        // Query the online_stores to get accounts info
        const { data: stores } = await supabase
            .from('online_stores')
            .select('id, seller_account')
            .in('id', storeIds)

        const storeMap = new Map(stores?.map(s => [s.id, s.seller_account]) || [])

        // Loop through each selected store to push
        for (const storeId of storeIds) {
            const sellerAccount = storeMap.get(storeId) || storeId
            try {
                // 1. Get valid access token
                const accessToken = await getValidAccessToken(storeId, 'order')

                // 2. Migrate main images to Daraz CDN using this store's token
                console.log(`[DarazCreate] Migrating main images for ${sellerAccount}...`)
                const darazMainImages = await migrateImagesToDaraz(images, accessToken)

                // Automatically replace Supabase image URLs inside the description with their migrated Daraz CDN counterparts
                let migratedDescription = description || ''
                if (Array.isArray(images) && darazMainImages) {
                    (images as string[]).forEach((supabaseUrl: string, index: number) => {
                        const darazUrl = darazMainImages[index]
                        if (supabaseUrl && darazUrl) {
                            migratedDescription = migratedDescription.split(supabaseUrl).join(darazUrl)
                        }
                    })
                }

                // 3. Migrate variant-specific images
                const enrichedSkus: DarazSkuVariant[] = []
                for (const sku of skus) {
                    let darazSkuImages: string[] = []
                    if (sku.images && sku.images.length > 0) {
                        console.log(`[DarazCreate] Migrating variant images for ${sellerAccount}...`)
                        darazSkuImages = await migrateImagesToDaraz(sku.images, accessToken)
                    }

                    // Map variant fields like color_family or size if they are inside attributes
                    // Daraz accepts variant fields as direct child nodes under <Sku>
                    const variantAttributes: Record<string, string> = {}
                    
                    // Default to 'Not Specified' to satisfy Daraz mandatory SKU attribute requirements
                    variantAttributes.color_family = 'Not Specified'
                    
                    if (attributes) {
                        if (attributes.color_family) variantAttributes.color_family = attributes.color_family
                        if (attributes.size) variantAttributes.size = attributes.size
                    }
                    // If user sent specific variant properties, add them
                    if (sku.color_family) variantAttributes.color_family = sku.color_family
                    if (sku.size) variantAttributes.size = sku.size

                    enrichedSkus.push({
                        sellerSku: sku.sellerSku,
                        price: sku.price,
                        specialPrice: sku.specialPrice,
                        specialPriceFrom: sku.specialPriceFrom,
                        specialPriceTo: sku.specialPriceTo,
                        quantity: sku.quantity,
                        packageWeight: sku.packageWeight,
                        packageLength: sku.packageLength,
                        packageWidth: sku.packageWidth,
                        packageHeight: sku.packageHeight,
                        packageContent: sku.packageContent || 'Standard Package',
                        images: darazSkuImages.length > 0 ? darazSkuImages : [darazMainImages[0]],
                        variantAttributes
                    })
                }

                // Format shortDescription (highlights) to valid HTML ul/li if not already HTML
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

                // Fetch category schema and filter out non-required (optional) attributes
                let filteredAttributes: Record<string, string> = {}
                try {
                    const attrParams = buildSignedParams('/category/attributes/get', accessToken, {
                        primary_category_id: String(primaryCategory),
                        language_code: 'en_US'
                    })
                    const attrRes = await axios.get(`${API_URL}/category/attributes/get`, { params: attrParams })
                    if (attrRes.data?.code === '0' || attrRes.data?.code === 0) {
                        const allAttrs = attrRes.data?.data || []
                        const mandatoryKeys = new Set(
                            allAttrs
                                .filter((a: any) => a.is_mandatory === 1 || a.is_mandatory === '1')
                                .map((a: any) => a.name)
                        )
                        // Filter inputs: keep required ones, plus brand and warranty_type
                        Object.entries(attributes || {}).forEach(([key, val]) => {
                            if (mandatoryKeys.has(key) || key === 'brand' || key === 'warranty_type') {
                                filteredAttributes[key] = String(val)
                            }
                        })
                    } else {
                        filteredAttributes = attributes || {}
                    }
                } catch (attrErr) {
                    console.warn('[DarazCreate] Failed to filter attributes schema, fallback to raw attributes:', attrErr)
                    filteredAttributes = attributes || {}
                }

                // 4. Build product payload
                const productPayload: DarazProductPayload = {
                    primaryCategory,
                    images: darazMainImages,
                    name,
                    shortDescription: formattedShortDesc,
                    description: migratedDescription,
                    brand: brand || 'Remark', // Default Brand if empty
                    attributes: {
                        warranty_type: 'No Warranty', // Default fallback
                        ...filteredAttributes
                    },
                    skus: enrichedSkus
                }

                // 5. Generate XML
                const xmlPayload = buildProductCreateXml(productPayload)

                // 6. Push to Daraz
                const apiPath = '/product/create'
                const params = buildSignedParams(apiPath, accessToken, { payload: xmlPayload })

                console.log(`[DarazCreate] Posting XML payload to ${sellerAccount}...`)
                const response = await axios.post(`${API_URL}${apiPath}`, null, {
                    params
                })

                const data = response.data

                if (data.code !== '0' && data.code !== 0) {
                    console.error('[DarazCreate] Full Error Response:', JSON.stringify(data, null, 2))
                    
                    let errMsg = data.message || data.msg || 'Push failed'
                    if (data.detail && Array.isArray(data.detail) && data.detail.length > 0) {
                        const detailedMsgs = data.detail
                            .map((d: any) => d.message)
                            .filter(Boolean)
                            .join(' | ')
                        if (detailedMsgs) {
                            errMsg = `${errMsg}: ${detailedMsgs}`
                        }
                    }
                    throw new Error(errMsg)
                }

                results.push({
                    storeId,
                    sellerAccount,
                    success: true,
                    itemId: data.data?.item_id,
                    skus: data.data?.sku_list || []
                })

            } catch (err: any) {
                console.error(`[DarazCreate] Failed for ${sellerAccount}:`, err.message)
                results.push({
                    storeId,
                    sellerAccount,
                    success: false,
                    error: err.message
                })
            }
        }

        // ── Auto-sync successful listing to main inventory list ──────────────────
        const successfulPushes = results.filter((r: any) => r.success)
        if (successfulPushes.length > 0) {
            try {
                const supabase = await createAdminClient()
                const rawProductName = (rawName || name || '').trim()

                if (rawProductName) {
                    // Check if product already exists in products table by raw name
                    const { data: existing } = await supabase
                        .from('products')
                        .select('*')
                        .eq('product_name', rawProductName)
                        .eq('is_deleted', false)
                        .maybeSingle()

                    // Build mapping for successful pushes (up to 4 seller accounts & SKUs)
                    const payload: Record<string, any> = {}
                    successfulPushes.slice(0, 4).forEach((push, idx) => {
                        const num = idx + 1
                        const skuObj = push.skus?.[0]
                        const skuStr = skuObj?.seller_sku || skuObj?.sellerSku || skus[0]?.sellerSku || ''
                        payload[`seller_account${num}`] = push.sellerAccount
                        payload[`seller_sku${num}`] = skuStr
                    })

                    let targetProductId = existing?.id

                    if (existing) {
                        console.log(`[DarazCreate] Product already exists in inventory: "${rawProductName}". Merging new store accounts...`)
                        const updatePayload: Record<string, any> = {}

                        // Merge store accounts safely into empty slots
                        for (let i = 1; i <= 4; i++) {
                            const targetAccount = payload[`seller_account${i}`]
                            const targetSku = payload[`seller_sku${i}`]
                            if (!targetAccount) continue

                            // If this account is already listed in any slot, skip it
                            let alreadyExists = false
                            for (let j = 1; j <= 4; j++) {
                                if (existing[`seller_account${j}`] === targetAccount) {
                                    alreadyExists = true
                                    break
                                }
                            }
                            if (alreadyExists) continue

                            // Write to first available empty slot
                            for (let j = 1; j <= 4; j++) {
                                if (!existing[`seller_account${j}`]) {
                                    updatePayload[`seller_account${j}`] = targetAccount
                                    updatePayload[`seller_sku${j}`] = targetSku
                                    existing[`seller_account${j}`] = targetAccount // mark filled locally
                                    break
                                }
                            }
                        }

                        const baseUpdate = {
                            updated_at: new Date().toISOString(),
                            is_new_pushed: true,
                            pushed_at: new Date().toISOString(),
                            approval_status: 'Pending'
                        }

                        if (Object.keys(updatePayload).length > 0) {
                            await supabase
                                .from('products')
                                .update({
                                    ...updatePayload,
                                    ...baseUpdate
                                })
                                .eq('id', existing.id)
                        } else {
                            await supabase
                                .from('products')
                                .update(baseUpdate)
                                .eq('id', existing.id)
                        }

                    } else {
                        console.log(`[DarazCreate] Inserting new product into inventory: "${rawProductName}"...`)
                        const { data: newProd, error: insertErr } = await supabase
                            .from('products')
                            .insert({
                                product_name: rawProductName,
                                image_url: images[0] || null,
                                product_type: 'single',
                                status: 'Active',
                                seller_account1: payload.seller_account1 || null,
                                seller_sku1: payload.seller_sku1 || null,
                                seller_account2: payload.seller_account2 || null,
                                seller_sku2: payload.seller_sku2 || null,
                                seller_account3: payload.seller_account3 || null,
                                seller_sku3: payload.seller_sku3 || null,
                                seller_account4: payload.seller_account4 || null,
                                seller_sku4: payload.seller_sku4 || null,
                                import_flag: false,
                                is_deleted: false,
                                approval_status: 'Pending',
                                marketplace_sync_status: 'Done',
                                website_sync_status: 'Pending',
                                product_title: name,
                                description: description || '',
                                highlights: shortDescription || '',
                                regular_price: skus[0]?.price || 0,
                                special_price: skus[0]?.specialPrice || null,
                                is_new_pushed: true,
                                pushed_at: new Date().toISOString()
                            })
                            .select('id')
                            .single()

                        if (newProd) {
                            targetProductId = newProd.id
                        }
                    }

                    // Auto-insert wholesale price & supplier into product_wholesale_prices if provided
                    const targetSupplierId = supplier_id || supplierId
                    const targetWholesalePrice = wholesale_price ?? wholesalePrice

                    if (targetProductId && targetSupplierId && targetWholesalePrice !== undefined && targetWholesalePrice !== null && Number(targetWholesalePrice) > 0) {
                        console.log(`[DarazCreate] Saving wholesale price NPR ${targetWholesalePrice} for supplier ${targetSupplierId}...`)
                        await supabase
                            .from('product_wholesale_prices')
                            .insert({
                                product_id: targetProductId,
                                supplier_id: targetSupplierId,
                                wholesale_price: Number(targetWholesalePrice)
                            })
                    }
                }
            } catch (dbErr: any) {
                console.error('[DarazCreate] Failed to sync product to inventory:', dbErr.message)
            }
        }

        return NextResponse.json({
            success: true,
            results
        })

    } catch (error: any) {
        console.error('[DarazProductCreate] General error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
