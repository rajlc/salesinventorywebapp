'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { signRequest } from '@/features/sales/actions/daraz-sync-order'
import axios from 'axios'
import { revalidatePath } from 'next/cache'

/**
 * Syncs product listings from all active Daraz stores.
 */
export async function syncAllDarazProductsAction() {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_APP_SECRET?.trim()
    const apiUrl = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    const supabase = await createAdminClient()

    // 1. Fetch active stores
    const { data: stores, error: storesError } = await supabase
        .from('online_stores')
        .select('id, seller_account, seller_id')
        .eq('is_active', true)

    if (storesError) {
        throw new Error(`Failed to fetch stores: ${storesError.message}`)
    }

    if (!stores || stores.length === 0) {
        return { success: true, message: 'No active stores found to sync.' }
    }

    // 2. Fetch Sync Cutoff settings
    const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_sync_rules')
        .maybeSingle()

    const productCutoffDate = settingsData?.value?.product_cutoff_date
        ? new Date(settingsData.value.product_cutoff_date)
        : null

    let totalSynced = 0
    let totalSkipped = 0
    let totalDuplicates = 0

    // Fetch existing SKUs to prevent duplicates in memory
    const { data: existingProducts, error: existingError } = await supabase
        .from('products')
        .select('seller_sku1, seller_sku2, seller_sku3, seller_sku4')
        .eq('is_deleted', false)

    if (existingError) {
        throw new Error(`Failed to fetch existing products: ${existingError.message}`)
    }

    const existingSkusSet = new Set<string>()
    existingProducts?.forEach(p => {
        if (p.seller_sku1) existingSkusSet.add(p.seller_sku1.toLowerCase().trim())
        if (p.seller_sku2) existingSkusSet.add(p.seller_sku2.toLowerCase().trim())
        if (p.seller_sku3) existingSkusSet.add(p.seller_sku3.toLowerCase().trim())
        if (p.seller_sku4) existingSkusSet.add(p.seller_sku4.toLowerCase().trim())
    })

    // Fetch Category Mappings from daraz_website_category_mappings
    // Map: daraz_category (lower) -> { website_category, marketplace_category }
    type CategoryMapping = { website_category: string | null; marketplace_category: string | null }
    const mappingMap = new Map<string, CategoryMapping>()
    try {
        let rawMappings: any[] = []
        const { data: md1, error: me1 } = await supabase
            .from('daraz_website_category_mappings')
            .select('daraz_category, website_category, marketplace_category')
        if (me1) {
            // Column may not exist yet — fall back
            const { data: md2 } = await supabase
                .from('daraz_website_category_mappings')
                .select('daraz_category, website_category')
            rawMappings = md2 || []
        } else {
            rawMappings = md1 || []
        }
        for (const m of rawMappings) {
            if (m.daraz_category) {
                mappingMap.set(m.daraz_category.toLowerCase().trim(), {
                    website_category: m.website_category || null,
                    marketplace_category: m.marketplace_category || null,
                })
            }
        }
    } catch (mapErr: any) {
        console.error(`[ProductSync] Failed to fetch category mappings:`, mapErr.message)
    }

    // 3. Loop through each store and pull products
    for (const store of stores) {
        // Get Token for this store
        const { data: tokenData } = await supabase
            .from('daraz_api_tokens')
            .select('*')
            .eq('store_id', store.id)
            .eq('app_type', 'order') // Matches existing app_type pattern
            .maybeSingle()

        if (!tokenData || !tokenData.access_token) {
            console.log(`[ProductSync] No token found for store: ${store.seller_account}. Skipping.`)
            continue
        }

        try {
            // Fetch category tree to resolve category names
            const categoryMap = new Map<string, string>()
            try {
                const catTimestamp = Date.now().toString()
                const catParams: Record<string, any> = {
                    app_key: appKey,
                    access_token: tokenData.access_token,
                    timestamp: catTimestamp,
                    sign_method: 'sha256'
                }
                catParams.sign = signRequest('/category/tree/get', catParams, appSecret)
                const catResponse = await axios.get(`${apiUrl}/category/tree/get`, { params: catParams })
                if (catResponse.data?.code === "0" || catResponse.data?.code === 0) {
                    const categoriesList = catResponse.data?.data || []
                    
                    const buildCategoryMap = (list: any[]) => {
                        for (const cat of list) {
                            const id = String(cat.category_id)
                            if (cat.name) {
                                categoryMap.set(id, cat.name)
                            }
                            if (cat.children && cat.children.length > 0) {
                                buildCategoryMap(cat.children)
                            }
                        }
                    }
                    buildCategoryMap(categoriesList)
                } else {
                    console.warn(`[ProductSync] Failed to fetch category tree for ${store.seller_account}:`, catResponse.data?.message || catResponse.data?.msg)
                }
            } catch (catErr: any) {
                console.error(`[ProductSync] Failed to fetch category tree request:`, catErr.message)
            }
            // Call Daraz /products/get API. Pulling all products dynamically
            const limit = 50
            let pageIndex = 0
            while (true) {
                const offset = pageIndex * limit
                const timestamp = Date.now().toString()

                const params: Record<string, any> = {
                    app_key: appKey,
                    access_token: tokenData.access_token,
                    timestamp: timestamp,
                    sign_method: 'sha256',
                    filter: 'all', // Get active, inactive, drafts etc.
                    limit: limit,
                    offset: offset
                }

                params.sign = signRequest('/products/get', params, appSecret)

                const response = await axios.get(`${apiUrl}/products/get`, { params })

                if (response.data.code !== "0" && response.data.code !== 0) {
                    console.error(`[ProductSync] Daraz API Error for ${store.seller_account}:`, response.data.message || response.data.msg)
                    break
                }

                const productsList = response.data?.data?.products || []
                if (productsList.length === 0) break

                for (const item of productsList) {
                    const createdTimestamp = item.created_time ? parseInt(item.created_time) : null
                    const createdDate = createdTimestamp ? new Date(createdTimestamp) : null

                    // Apply Cutoff check
                    if (productCutoffDate && createdDate && createdDate < productCutoffDate) {
                        totalSkipped++
                        continue
                    }

                    const productName = item.attributes?.name || 'Daraz Product'
                    const mainImage = item.images?.[0] || null
                    const description = item.attributes?.description || null
                    const highlights = item.attributes?.short_description || null
                    
                    const categoryIdStr = item.primary_category ? String(item.primary_category) : null
                    const categoryName = categoryIdStr ? (categoryMap.get(categoryIdStr) || categoryIdStr) : null

                    // Rule: if no Daraz category → no website or marketplace category
                    const categoryMapping = categoryName
                        ? (mappingMap.get(categoryName.toLowerCase().trim()) || null)
                        : null
                    const matchedWebsiteCategory = categoryName ? (categoryMapping?.website_category || null) : null
                    const matchedMarketplaceCategory = categoryName ? (categoryMapping?.marketplace_category || null) : null

                    const skus = item.skus || []
                    for (const sku of skus) {
                        const sellerSku = (sku.SellerSku || '').trim()
                        if (!sellerSku) continue

                        const skuImage = sku.Images?.[0] || mainImage || null
                        const darazProductUrl = sku.Url || null
                        
                        // Parse other images: exclude main image
                        const skuImages = (sku.Images && sku.Images.length > 0) ? sku.Images : (item.images || [])
                        const otherImages = skuImages.slice(1)

                        // Parse prices
                        const regularPrice = sku.price ? parseFloat(sku.price) : null
                        const specialPrice = sku.special_price ? parseFloat(sku.special_price) : null

                        // Check if product with this SKU already exists
                        const { data: existingProd } = await supabase
                            .from('products')
                            .select('id')
                            .eq('seller_sku1', sellerSku)
                            .eq('is_deleted', false)
                            .maybeSingle()

                        const productData = {
                            product_name: productName,
                            product_title: productName,
                            image_url: skuImage,
                            other_images: otherImages,
                            status: item.status || 'Active', // status mapping matching the live status
                            regular_price: regularPrice,
                            special_price: specialPrice,
                            description: description,
                            highlights: highlights,
                            category_name: categoryName,
                            website_category: matchedWebsiteCategory,
                            marketplace_category: matchedMarketplaceCategory,
                            updated_at: new Date().toISOString()
                        }

                        if (existingProd) {
                            // Update existing product
                            const { error: updateError } = await supabase
                                .from('products')
                                .update(productData)
                                .eq('id', existingProd.id)
                            
                            if (updateError) {
                                console.error(`[ProductSync] Failed to update product ID ${existingProd.id}:`, updateError.message)
                            } else {
                                totalSynced++
                            }
                        } else {
                            // Insert new product
                            const { error: insertError } = await supabase
                                .from('products')
                                .insert({
                                    ...productData,
                                    product_type: 'single',
                                    seller_sku1: sellerSku,
                                    seller_account1: store.seller_account,
                                    approval_status: 'Pending',
                                    marketplace_sync_status: 'Pending',
                                    website_sync_status: 'Pending',
                                    import_flag: true,
                                    daraz_product_url: darazProductUrl,
                                    created_at: new Date().toISOString()
                                })
                            
                            if (insertError) {
                                console.error(`[ProductSync] Failed to insert product SKU ${sellerSku}:`, insertError.message)
                            } else {
                                totalSynced++
                            }
                        }
                    }
                }

                // If less than limit returned, no more products
                if (productsList.length < limit) break
                pageIndex++
            }
        } catch (err: any) {
            console.error(`[ProductSync] Request failed for store ${store.seller_account}:`, err.message)
        }
    }

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/inventory/daraz-product-management')

    return {
        success: true,
        totalSynced,
        totalSkipped,
        message: `Sync completed! Upserted ${totalSynced} products in the database.`
    }
}

/**
 * Syncs Daraz data (images, description, highlights, price, URL) for a specific
 * set of already-existing inventory products identified by their internal DB IDs.
 *
 * Strategy: fetch ALL live products from Daraz (paginated, same as full sync),
 * build a SKU→productData map in memory, then look up each selected product's
 * SKU and update the matching DB record.
 *
 * This UPDATES existing records (does NOT insert new ones).
 */
export async function syncSelectedProductsFromDaraz(productIds: string[]): Promise<{
    success: boolean
    updated: number
    notFound: number
    errors: string[]
    message: string
}> {
    if (!productIds || productIds.length === 0) {
        return { success: true, updated: 0, notFound: 0, errors: [], message: 'No products selected.' }
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_APP_SECRET?.trim()
    const apiUrl = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    const supabase = await createAdminClient()

    // 1. Fetch the selected products with their SKUs and seller accounts
    const { data: selectedProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, seller_account1, seller_account2, seller_account3, seller_account4')
        .in('id', productIds)
        .eq('is_deleted', false)

    if (fetchError) throw new Error(`Failed to fetch selected products: ${fetchError.message}`)
    if (!selectedProducts || selectedProducts.length === 0) {
        return { success: true, updated: 0, notFound: productIds.length, errors: [], message: 'No matching products found in database.' }
    }

    // Collect all unique SKUs we need to find (lowercased for comparison)
    const neededSkus = new Set<string>()
    for (const p of selectedProducts) {
        if (p.seller_sku1) neededSkus.add(p.seller_sku1.toLowerCase().trim())
        if (p.seller_sku2) neededSkus.add(p.seller_sku2.toLowerCase().trim())
        if (p.seller_sku3) neededSkus.add(p.seller_sku3.toLowerCase().trim())
        if (p.seller_sku4) neededSkus.add(p.seller_sku4.toLowerCase().trim())
    }

    // 2. Fetch active stores and their tokens
    const { data: stores } = await supabase
        .from('online_stores')
        .select('id, seller_account')
        .eq('is_active', true)

    if (!stores || stores.length === 0) {
        throw new Error('No active Daraz stores configured.')
    }

    // 3. Fetch category mappings (website + marketplace)
    type CatMapping = { website_category: string | null; marketplace_category: string | null }
    const mappingMap = new Map<string, CatMapping>()
    try {
        const { data: mappingsData } = await supabase
            .from('daraz_website_category_mappings')
            .select('daraz_category, website_category, marketplace_category')
        if (mappingsData) {
            for (const m of mappingsData) {
                if (m.daraz_category) {
                    mappingMap.set(m.daraz_category.toLowerCase().trim(), {
                        website_category: m.website_category || null,
                        marketplace_category: m.marketplace_category || null,
                    })
                }
            }
        }
    } catch (_) {}

    // 4. For each store, fetch ALL pages from Daraz and build a SKU → enriched data map
    //    SKU key is lowercased for case-insensitive matching
    type DarazSkuData = {
        image_url: string | null
        other_images: string[]
        description: string | null
        highlights: string | null
        daraz_product_url: string | null
        regular_price: number | null
        special_price: number | null
        product_title: string | null
        category_name: string | null
        website_category: string | null
        marketplace_category: string | null
    }
    const skuDataMap = new Map<string, DarazSkuData>()

    for (const store of stores) {
        // Get token for this store
        const { data: tokenData } = await supabase
            .from('daraz_api_tokens')
            .select('access_token')
            .eq('store_id', store.id)
            .eq('app_type', 'order')
            .maybeSingle()

        if (!tokenData?.access_token) {
            console.log(`[SelectedSync] No token for store: ${store.seller_account}. Skipping.`)
            continue
        }

        const accessToken = tokenData.access_token

        // Build category map for this store (same as full sync)
        const categoryMap = new Map<string, string>()
        try {
            const catTimestamp = Date.now().toString()
            const catParams: Record<string, any> = {
                app_key: appKey,
                access_token: accessToken,
                timestamp: catTimestamp,
                sign_method: 'sha256',
            }
            catParams.sign = signRequest('/category/tree/get', catParams, appSecret)
            const catResponse = await axios.get(`${apiUrl}/category/tree/get`, { params: catParams })
            if (catResponse.data?.code === '0' || catResponse.data?.code === 0) {
                const buildCategoryMap = (list: any[]) => {
                    for (const cat of list) {
                        if (cat.name) categoryMap.set(String(cat.category_id), cat.name)
                        if (cat.children?.length) buildCategoryMap(cat.children)
                    }
                }
                buildCategoryMap(catResponse.data?.data || [])
            }
        } catch (catErr: any) {
            console.error(`[SelectedSync] Category fetch failed for ${store.seller_account}:`, catErr.message)
        }

        // Fetch pages from Daraz until we've seen all needed SKUs or exhausted results
        const limit = 50
        let pageIndex = 0
        const maxPages = 20 // up to 1000 products per store

        while (pageIndex < maxPages) {
            const offset = pageIndex * limit
            const timestamp = Date.now().toString()
            const params: Record<string, any> = {
                app_key: appKey,
                access_token: accessToken,
                timestamp,
                sign_method: 'sha256',
                filter: 'live',
                limit,
                offset,
            }
            params.sign = signRequest('/products/get', params, appSecret)

            try {
                const response = await axios.get(`${apiUrl}/products/get`, { params })

                if (response.data.code !== '0' && response.data.code !== 0) {
                    console.error(`[SelectedSync] Daraz API error page ${pageIndex} for ${store.seller_account}:`, response.data.message)
                    break
                }

                const productsList: any[] = response.data?.data?.products || []
                if (productsList.length === 0) break

                for (const item of productsList) {
                    const mainImage = item.images?.[0] || null
                    const description = item.attributes?.description || null
                    const highlights = item.attributes?.short_description || null
                    const productName = item.attributes?.name || null
                    const categoryIdStr = item.primary_category ? String(item.primary_category) : null
                    const categoryName = categoryIdStr ? (categoryMap.get(categoryIdStr) || null) : null

                    // Rule: if no Daraz category → no website or marketplace category
                    const catMapping = categoryName
                        ? (mappingMap.get(categoryName.toLowerCase().trim()) || null)
                        : null
                    const websiteCategory = categoryName ? (catMapping?.website_category || null) : null
                    const marketplaceCategory = categoryName ? (catMapping?.marketplace_category || null) : null

                    for (const sku of (item.skus || [])) {
                        const sellerSku = (sku.SellerSku || '').trim()
                        if (!sellerSku) continue

                        const skuKey = sellerSku.toLowerCase()
                        const skuImages = (sku.Images && sku.Images.length > 0)
                            ? sku.Images
                            : (item.images || [])
                        const skuImage = sku.Images?.[0] || mainImage || null
                        const otherImages = skuImages.slice(1)

                        skuDataMap.set(skuKey, {
                            image_url: skuImage,
                            other_images: otherImages,
                            description,
                            highlights,
                            daraz_product_url: sku.Url || null,
                            regular_price: sku.price ? parseFloat(sku.price) : null,
                            special_price: sku.special_price ? parseFloat(sku.special_price) : null,
                            product_title: productName,
                            category_name: categoryName,
                            website_category: websiteCategory,
                            marketplace_category: marketplaceCategory,
                        })
                    }
                }

                // Stop fetching more pages for this store if we found all needed SKUs
                const foundAll = [...neededSkus].every(s => skuDataMap.has(s))
                if (foundAll || productsList.length < limit) break

                pageIndex++
            } catch (err: any) {
                console.error(`[SelectedSync] Page ${pageIndex} fetch failed for ${store.seller_account}:`, err.message)
                break
            }
        }
    }

    // 5. Now match each selected product's SKUs against the map and update DB
    let updated = 0
    let notFound = 0
    const errors: string[] = []

    for (const product of selectedProducts) {
        const candidateSkus = [
            product.seller_sku1,
            product.seller_sku2,
            product.seller_sku3,
            product.seller_sku4,
        ].filter(Boolean) as string[]

        if (candidateSkus.length === 0) {
            notFound++
            continue
        }

        let darazData: DarazSkuData | undefined
        for (const sku of candidateSkus) {
            darazData = skuDataMap.get(sku.toLowerCase().trim())
            if (darazData) break
        }

        if (!darazData) {
            notFound++
            continue
        }

        // Build update payload.
        // Category fields are ALWAYS written (even null) to enforce the rule:
        // no Daraz category → clear website_category and marketplace_category.
        const updatePayload: Record<string, any> = {
            category_name: darazData.category_name,
            website_category: darazData.category_name ? darazData.website_category : null,
            marketplace_category: darazData.category_name ? darazData.marketplace_category : null,
        }
        if (darazData.image_url) updatePayload.image_url = darazData.image_url
        if (darazData.other_images.length > 0) updatePayload.other_images = darazData.other_images
        if (darazData.description) updatePayload.description = darazData.description
        if (darazData.highlights) updatePayload.highlights = darazData.highlights
        if (darazData.daraz_product_url) updatePayload.daraz_product_url = darazData.daraz_product_url
        if (darazData.regular_price !== null) updatePayload.regular_price = darazData.regular_price
        if (darazData.special_price !== null) updatePayload.special_price = darazData.special_price
        if (darazData.product_title) updatePayload.product_title = darazData.product_title

        if (Object.keys(updatePayload).length === 0) {
            notFound++
            continue
        }

        const { error: updateError } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', product.id)

        if (updateError) {
            errors.push(`Product ${product.id}: ${updateError.message}`)
            notFound++
        } else {
            updated++
        }
    }

    revalidatePath('/dashboard/inventory/product-list')

    return {
        success: true,
        updated,
        notFound,
        errors,
        message: `Updated ${updated} products from Daraz.${notFound > 0 ? ` ${notFound} products had no Daraz match.` : ''}`
    }
}

