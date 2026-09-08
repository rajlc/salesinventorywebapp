import { createAdminClient } from '@/lib/supabase/server'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { cleanImageUrl } from '@/lib/daraz/image-migrate'
import { resolveBestCategory, searchDarazCategories } from '@/lib/daraz/category-service'
import { extractCompetitorProduct } from '@/lib/daraz/link-extractor'
import { fetchAndOptimizeImage, OptimizedImage } from './image-helper'
import axios from 'axios'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ViewDraftImagesInput {
    id?: string
    raw_name?: string
    image_url?: string
    max_images?: number
}

export interface StoreAccountInfo {
    id: string
    seller_account: string
    seller_id: string
    is_active: boolean
}

export interface VariantItemInput {
    name?: string
    color?: string
    size?: string
    price?: number
    special_price?: number
    stock?: number
    seller_sku?: string
    images?: string[]
}

export interface SaveDraftInput {
    raw_name?: string
    title?: string
    titles_per_store?: Record<string, string>
    description?: string
    highlights?: string[] | string
    price?: number
    special_price?: number
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    attributes?: Record<string, any>
    variants?: VariantItemInput[] | string[]
    images?: string[]
    supplier_id?: string
    wholesale_price?: number
    product_link?: string
}

export interface UpdateDraftInput {
    id?: string
    raw_name?: string
    title?: string
    titles_per_store?: Record<string, string>
    description?: string
    highlights?: string[] | string
    price?: number
    special_price?: number
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    attributes?: Record<string, any>
    variants?: VariantItemInput[] | string[]
    images?: string[]
    supplier_id?: string
    wholesale_price?: number
    product_link?: string
    status?: 'draft' | 'generating' | 'generated' | 'pushing' | 'pushed' | 'failed'
}

export interface DeleteDraftInput {
    id?: string
    raw_name?: string
}

export interface GetDraftDetailsInput {
    id?: string
    raw_name?: string
}

export interface BulkAddProductItem {
    name: string
    title?: string
    description?: string
    highlights?: string[]
    price?: number
    special_price?: number
    wholesale_price?: number
    variants?: VariantItemInput[] | string[]
    images?: string[]
}

export interface BulkAddInput {
    products: BulkAddProductItem[]
    store_account_name?: string
    store_accounts?: string[]
}

export interface PushProductInput {
    product_name: string
    title?: string
    price?: number
    special_price?: number
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    category_name?: string
    category?: string
    attributes?: Record<string, any>
    variants?: VariantItemInput[] | string[]
    images?: string[]
    description?: string
    highlights?: string[]
    brand?: string
}

export interface GetDraftsInput {
    status?: 'draft' | 'generating' | 'generated' | 'pushing' | 'pushed' | 'failed' | 'all'
    type?: 'image_only' | 'link_only' | 'name_only' | 'pending' | 'ready' | 'pushed' | 'all'
    limit?: number
    search?: string
}

export function computeDraftType(item: {
    raw_name?: string | null
    title?: string | null
    images?: string[] | null
    category_id?: number | null
    description?: string | null
    highlights?: string[] | null
    product_link?: string | null
    status?: string | null
}): 'image_only' | 'link_only' | 'name_only' | 'pending' | 'ready' | 'pushed' {
    if (item.status === 'pushed') return 'pushed'

    const hasImages = Array.isArray(item.images) && item.images.length > 0
    const hasLink = Boolean(item.product_link && item.product_link.trim().length > 0)
    const isAutoName = !item.raw_name || item.raw_name.startsWith('[Image Only]') || item.raw_name.startsWith('[Link]') || item.raw_name.startsWith('Raw Product')
    const hasRealName = Boolean(item.raw_name && !isAutoName && item.raw_name.trim().length > 0)

    if (hasImages && !hasLink && !hasRealName) return 'image_only'
    if (hasLink && !hasImages && !hasRealName) return 'link_only'
    if (hasRealName && !hasImages && !hasLink) return 'name_only'

    const hasTitle = Boolean(item.title && item.title.trim().length > 0)
    const hasCategory = Boolean(item.category_id)
    const hasHighlights = Boolean(item.highlights && item.highlights.length > 0 && item.highlights.some(h => h.trim().length > 0))
    const hasDesc = Boolean(item.description && item.description.trim().length > 0)

    if ((hasTitle || hasRealName) && hasCategory && hasHighlights && hasDesc && hasImages) {
        return 'ready'
    }

    return 'pending'
}

// ── Store Helpers ───────────────────────────────────────────────────────────

export async function listDarazStores(): Promise<StoreAccountInfo[]> {
    const supabase = await createAdminClient()
    const { data: stores, error } = await supabase
        .from('online_stores')
        .select('id, seller_account, seller_id, is_active')
        .eq('is_active', true)

    if (error) {
        console.error('[ClaudeConnector] Error fetching stores:', error.message)
        return []
    }
    return stores || []
}

export async function findStoreByAccount(accountNameOrId?: string): Promise<StoreAccountInfo | null> {
    const stores = await listDarazStores()
    if (stores.length === 0) return null

    if (!accountNameOrId || accountNameOrId.trim() === '') {
        return stores[0] // Default to first active store
    }

    const term = accountNameOrId.trim().toLowerCase()

    // 1. Exact ID match
    const byId = stores.find(s => s.id.toLowerCase() === term)
    if (byId) return byId

    // 2. Exact or partial account name match (e.g. "Bagmati", "Bagmati Traders", "Balaju Shop")
    const byName = stores.find(s => 
        s.seller_account.toLowerCase().includes(term) || 
        term.includes(s.seller_account.toLowerCase())
    )
    if (byName) return byName

    return stores[0]
}

export async function resolveTargetStores(input: { store_account_name?: string, store_accounts?: string[] }): Promise<StoreAccountInfo[]> {
    const allStores = await listDarazStores()
    if (allStores.length === 0) return []

    const queryList: string[] = []

    if (input.store_accounts && Array.isArray(input.store_accounts) && input.store_accounts.length > 0) {
        queryList.push(...input.store_accounts)
    } else if (input.store_account_name && input.store_account_name.trim()) {
        const parts = input.store_account_name.split(/\s*(?:,|and|\&)\s*/i).map(s => s.trim()).filter(Boolean)
        queryList.push(...parts)
    }

    if (queryList.length === 0) {
        return allStores.slice(0, 1) // default to first
    }

    const matched: StoreAccountInfo[] = []
    for (const q of queryList) {
        const term = q.toLowerCase()
        const found = allStores.find(s => 
            s.seller_account.toLowerCase().includes(term) || 
            term.includes(s.seller_account.toLowerCase()) ||
            s.id.toLowerCase() === term
        )
        if (found && !matched.some(m => m.id === found.id)) {
            matched.push(found)
        }
    }

    return matched.length > 0 ? matched : allStores.slice(0, 1)
}

// ── Pricing & Variant Helpers ───────────────────────────────────────────────

/**
 * Resolves pricing according to user requirement:
 * "when we give claude as a price then this price is our Special Price"
 * Generates regular price (MRP) with ~25% markup so Daraz renders a valid discount.
 */
export function resolvePricing(inputPrice?: number, inputSpecialPrice?: number): { price: number; specialPrice: number } {
    let special = inputSpecialPrice
    let regular = inputPrice

    if (special && !regular) {
        regular = Math.max(Math.round((special * 1.25) / 10) * 10, special + 100)
    } else if (regular && !special) {
        special = regular
        regular = Math.max(Math.round((special * 1.25) / 10) * 10, special + 100)
    } else if (!regular && !special) {
        regular = 0
        special = 0
    } else if (regular! <= special!) {
        regular = Math.max(Math.round((special! * 1.25) / 10) * 10, special! + 100)
    }

    return { price: regular!, specialPrice: special! }
}

/**
 * Builds standard Daraz SKU rows for variants:
 * - Automatic unique SellerSKU per variant
 * - Stock always set to 100 (or custom stock if provided)
 * - Price is MRP and specialPrice is user-provided price
 */
export function buildVariantSkuRows(rawName: string, variantsInput: any, defaultPrice: number, defaultSpecialPrice: number) {
    if (!variantsInput || (Array.isArray(variantsInput) && variantsInput.length === 0)) {
        return {
            hasVariants: false,
            variant1Name: 'Color Family',
            variant1Values: [] as string[],
            skuRows: [] as any[]
        }
    }

    const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 15) || 'prod'
    const items: any[] = []
    const variant1Values: string[] = []

    const rawList = Array.isArray(variantsInput) ? variantsInput : [variantsInput]

    rawList.forEach((v, i) => {
        let varName = ''
        let varSpecial = defaultSpecialPrice
        let varPrice = defaultPrice
        let varStock = 100
        let varSku = ''
        let varImages: string[] = []

        if (typeof v === 'string') {
            varName = v.trim()
        } else if (v && typeof v === 'object') {
            varName = (v.color || v.name || v.size || `Variant ${i + 1}`).trim()
            if (v.special_price) {
                varSpecial = v.special_price
                varPrice = v.price || Math.max(Math.round((varSpecial * 1.25) / 10) * 10, varSpecial + 100)
            } else if (v.price) {
                varSpecial = v.price
                varPrice = Math.max(Math.round((varSpecial * 1.25) / 10) * 10, varSpecial + 100)
            }
            varStock = (v.stock !== undefined && v.stock !== null) ? Number(v.stock) : 100
            varSku = v.seller_sku || ''
            varImages = v.images || []
        }

        if (!varName) return

        variant1Values.push(varName)
        const varSlug = varName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const randomDigits = Math.floor(1000 + Math.random() * 9000)
        const finalSku = varSku || `${slug.toUpperCase()}-${varSlug.toUpperCase()}-${randomDigits}`

        items.push({
            variant1: varName,
            price: varPrice,
            specialPrice: varSpecial,
            quantity: varStock,
            sellerSku: finalSku,
            available: true,
            images: varImages
        })
    })

    return {
        hasVariants: items.length > 0,
        variant1Name: 'Color Family',
        variant1Values,
        skuRows: items
    }
}

/**
 * Ensures all highlights start with bullet point '• '
 */
export function formatHighlights(rawHighlights: any): string[] {
    let list: string[] = []
    if (Array.isArray(rawHighlights)) {
        list = rawHighlights
            .map(h => String(h).replace(/^[\s*•\-\d.)]+/, '').trim())
            .filter(Boolean)
    } else if (typeof rawHighlights === 'string' && rawHighlights.trim()) {
        list = rawHighlights
            .split(/\r?\n/)
            .map(line => line.replace(/^[\s*•\-\d.)]+/, '').trim())
            .filter(Boolean)
    }

    if (list.length === 0) {
        list = [
            'Premium Quality & Durable Material',
            'Compact, Portable and Reliable',
            'Easy to Use with Long-Lasting Durability',
            'Best Value for Daily Use'
        ]
    }

    return list.map(item => item.startsWith('•') ? item : `• ${item}`)
}

/**
 * Formats description with clean paragraphs and bold formatting for Daraz
 */
export function formatDescription(desc?: string, rawName?: string): string {
    if (!desc || !desc.trim()) {
        return `<p><strong>${rawName || 'Product'}</strong></p>\n<p>High quality product designed for reliable everyday use, durability, and superior performance.</p>`
    }
    let d = desc.trim()
    // Convert markdown **bold** into <strong>bold</strong>
    d = d.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // If it lacks basic HTML tags, wrap paragraphs cleanly
    if (!d.includes('<p>') && !d.includes('<div>') && !d.includes('<ul>')) {
        d = d
            .split(/\r?\n\r?\n/)
            .map(para => `<p>${para.trim().replace(/\r?\n/g, '<br/>')}</p>`)
            .join('\n')
    }
    return d
}

// ── Save Product Draft ──────────────────────────────────────────────────────

export async function saveProductDraft(input: SaveDraftInput) {
    if (!input.raw_name || !input.raw_name.trim()) {
        throw new Error('Product name (raw_name) is required')
    }

    // 1. Resolve pricing (input price = special price, price = MRP)
    const pricing = resolvePricing(input.price, input.special_price)

    // 2. Resolve target stores
    const stores = await resolveTargetStores({
        store_account_name: input.store_account_name,
        store_accounts: input.store_accounts
    })
    const targetStoreIds = stores.map(s => s.id)

    // 3. Resolve Titles per store & Primary Title
    const resolvedTitlesPerStore: Record<string, string> = {}

    if (input.titles_per_store && typeof input.titles_per_store === 'object') {
        Object.entries(input.titles_per_store).forEach(([storeKey, titleVal]) => {
            const keyTerm = storeKey.toLowerCase()
            const matchedStore = stores.find(s => 
                s.seller_account.toLowerCase().includes(keyTerm) || 
                keyTerm.includes(s.seller_account.toLowerCase()) ||
                s.id === storeKey
            )
            if (matchedStore && titleVal) {
                resolvedTitlesPerStore[matchedStore.id] = titleVal
            }
        })
    }

    let rawName = (input.raw_name || '').trim()
    if (!rawName) {
        if (input.product_link) {
            try {
                const host = new URL(input.product_link).hostname.replace('www.', '')
                rawName = `[Link] - ${host} - ${new Date().toLocaleTimeString('en-US', { hour12: false })}`
            } catch {
                rawName = `[Link] - ${new Date().toLocaleTimeString('en-US', { hour12: false })}`
            }
        } else if (input.images && input.images.length > 0) {
            rawName = `[Image Only] - ${new Date().toLocaleTimeString('en-US', { hour12: false })}`
        } else {
            rawName = `Raw Product - ${new Date().toLocaleTimeString('en-US', { hour12: false })}`
        }
    }

    let baseTitle = input.title
    if (!baseTitle && (rawName.length > 40 || rawName.includes(' - ') || rawName.includes(' | '))) {
        baseTitle = rawName
        const shortName = rawName.split(/[-|—]/)[0].trim()
        if (shortName.length >= 3) {
            rawName = shortName
        }
    } else if (!baseTitle && !rawName.startsWith('[Image Only]') && !rawName.startsWith('[Link]')) {
        baseTitle = `${rawName} - Premium Quality & Durable`
    }

    stores.forEach(store => {
        if (!resolvedTitlesPerStore[store.id]) {
            resolvedTitlesPerStore[store.id] = baseTitle || rawName
        }
    })

    const primaryTitle = baseTitle || Object.values(resolvedTitlesPerStore)[0] || rawName

    // 4. Resolve Description & Highlights
    const description = formatDescription(input.description, rawName)
    const highlights = formatHighlights(input.highlights)

    // 5. Resolve Variants
    const variantInfo = buildVariantSkuRows(rawName, input.variants, pricing.price, pricing.specialPrice)
    const finalPrice = variantInfo.hasVariants && variantInfo.skuRows[0]?.price ? variantInfo.skuRows[0].price : pricing.price
    const finalSpecialPrice = variantInfo.hasVariants && variantInfo.skuRows[0]?.specialPrice ? variantInfo.skuRows[0].specialPrice : pricing.specialPrice

    // 6. Resolve Category
    let categoryId = input.category_id || null
    let categoryPath = input.category_path || (input as any).category_name || (input as any).category || null

    if (!categoryId || (categoryId === 10520 && !rawName.toLowerCase().includes('car'))) {
        try {
            const best = await resolveBestCategory(rawName, categoryPath)
            if (best) {
                categoryId = best.id
                categoryPath = best.path
            }
        } catch (catErr: any) {
            console.warn('[ClaudeConnector] Category resolve error:', catErr.message)
        }
    }

    // 7. Merge Specifications & Variants into Attributes
    const attributesPayload: Record<string, any> = {
        ...(input.attributes || {})
    }
    if (input.product_link) {
        attributesPayload.product_link = input.product_link
    }
    const computedDraftType = computeDraftType({
        raw_name: rawName,
        title: primaryTitle,
        images: input.images,
        category_id: categoryId,
        description,
        highlights,
        product_link: input.product_link,
        status: 'draft'
    })
    attributesPayload.draft_type = computedDraftType

    if (variantInfo.hasVariants) {
        attributesPayload.has_variants = true
        attributesPayload.variant1_name = variantInfo.variant1Name
        attributesPayload.variant1_values = variantInfo.variant1Values
        attributesPayload.sku_rows = variantInfo.skuRows
    }

    // 8. De-duplication / Merging with recent draft
    const supabase = await createAdminClient()
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: recentDrafts } = await supabase
        .from('daraz_draft_listings')
        .select('*')
        .ilike('raw_name', rawName)
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)

    if (recentDrafts && recentDrafts.length > 0) {
        const existing = recentDrafts[0]
        const mergedStoreIds = Array.from(new Set([...(existing.target_stores || []), ...targetStoreIds]))
        const mergedTitles = { ...(existing.titles_per_store || {}), ...resolvedTitlesPerStore }
        const mergedAttributes = { ...(existing.attributes || {}), ...attributesPayload }
        const mergedType = computeDraftType({
            raw_name: rawName,
            title: primaryTitle || existing.title,
            images: input.images || existing.images,
            category_id: categoryId || existing.category_id,
            description: description || existing.description,
            highlights: highlights.length > 0 ? highlights : existing.highlights,
            product_link: mergedAttributes.product_link,
            status: existing.status
        })
        mergedAttributes.draft_type = mergedType

        const { data: updated, error: updateErr } = await supabase
            .from('daraz_draft_listings')
            .update({
                target_stores: mergedStoreIds,
                titles_per_store: mergedTitles,
                title: primaryTitle || existing.title,
                description: description || existing.description,
                highlights: highlights.length > 0 ? highlights : existing.highlights,
                price: finalPrice || existing.price,
                special_price: finalSpecialPrice || existing.special_price,
                category_id: categoryId || existing.category_id,
                category_path: categoryPath || existing.category_path,
                attributes: mergedAttributes,
                status: mergedType === 'ready' ? 'generated' : (existing.status || 'draft'),
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select('*')
            .single()

        if (!updateErr && updated) {
            const allStores = await listDarazStores()
            const storeNames = mergedStoreIds.map(id => allStores.find(s => s.id === id)?.seller_account || id).join(', ')

            return {
                success: true,
                message: `Single draft updated for "${rawName}" across store(s): [${storeNames}]!`,
                draft: {
                    id: updated.id,
                    raw_name: updated.raw_name,
                    daraz_title: updated.title,
                    price: updated.price,
                    special_price: updated.special_price,
                    category: updated.category_path,
                    has_variants: !!updated.attributes?.has_variants,
                    variants_count: updated.attributes?.sku_rows?.length || 0,
                    product_link: updated.attributes?.product_link || null,
                    draft_type: mergedType,
                    status: updated.status,
                    assigned_stores: storeNames,
                    created_at: updated.created_at
                }
            }
        }
    }

    // 9. Save new draft
    const { data, error } = await supabase
        .from('daraz_draft_listings')
        .insert({
            raw_name: rawName,
            title: primaryTitle,
            titles_per_store: resolvedTitlesPerStore,
            description,
            highlights,
            category_id: categoryId,
            category_path: categoryPath,
            attributes: attributesPayload,
            images: (input.images || []).map(cleanImageUrl).filter(Boolean),
            target_stores: targetStoreIds,
            price: finalPrice || null,
            special_price: finalSpecialPrice || null,
            supplier_id: input.supplier_id || null,
            wholesale_price: input.wholesale_price || null,
            status: computedDraftType === 'ready' ? 'generated' : 'draft'
        })
        .select('*')
        .single()

    if (error) throw new Error(error.message)

    const storeNames = stores.map(s => s.seller_account).join(', ')

    return {
        success: true,
        message: `Draft created successfully for "${rawName}" across store(s): [${storeNames}]!`,
        draft: {
            id: data.id,
            raw_name: data.raw_name,
            daraz_title: data.title,
            price: data.price,
            special_price: data.special_price,
            category: data.category_path,
            has_variants: !!data.attributes?.has_variants,
            variants_count: data.attributes?.sku_rows?.length || 0,
            product_link: data.attributes?.product_link || null,
            draft_type: computedDraftType,
            status: data.status,
            assigned_stores: storeNames,
            created_at: data.created_at
        }
    }
}

// ── Update Product Draft ────────────────────────────────────────────────────

export async function updateProductDraft(input: UpdateDraftInput) {
    const supabase = await createAdminClient()

    let draftId = input.id
    let existingDraft: any = null

    if (draftId) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', draftId)
            .single()
        existingDraft = data
    } else if (input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(1)
        if (data && data.length > 0) {
            existingDraft = data[0]
            draftId = existingDraft.id
        }
    }

    if (!existingDraft || !draftId) {
        throw new Error(`Draft not found for: ${input.id || input.raw_name || 'unknown'}`)
    }

    const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
    }

    if (input.raw_name) updates.raw_name = input.raw_name.trim()
    if (input.title) updates.title = input.title.trim()
    if (input.titles_per_store) updates.titles_per_store = input.titles_per_store
    if (input.description) updates.description = formatDescription(input.description, updates.raw_name || existingDraft.raw_name)
    if (input.highlights) updates.highlights = formatHighlights(input.highlights)
    if (input.category_id !== undefined) updates.category_id = input.category_id
    if (input.category_path !== undefined) updates.category_path = input.category_path
    if (input.wholesale_price !== undefined) updates.wholesale_price = input.wholesale_price
    if (input.supplier_id !== undefined) updates.supplier_id = input.supplier_id
    if (input.images !== undefined) updates.images = input.images
    if (input.status) updates.status = input.status

    if (input.price !== undefined || input.special_price !== undefined) {
        const p = resolvePricing(input.price || existingDraft.price, input.special_price || existingDraft.special_price)
        updates.price = p.price
        updates.special_price = p.specialPrice
    }

    if (input.store_accounts || input.store_account_name) {
        const stores = await resolveTargetStores({
            store_account_name: input.store_account_name,
            store_accounts: input.store_accounts
        })
        updates.target_stores = stores.map(s => s.id)
    }

    let existingAttributes = { ...(existingDraft.attributes || {}) }
    if (input.product_link !== undefined) {
        existingAttributes.product_link = input.product_link
    }
    if (input.attributes) {
        existingAttributes = { ...existingAttributes, ...input.attributes }
    }

    if (input.variants) {
        const currentPrice = updates.price || existingDraft.price || 0
        const currentSpecial = updates.special_price || existingDraft.special_price || 0
        const variantInfo = buildVariantSkuRows(updates.raw_name || existingDraft.raw_name, input.variants, currentPrice, currentSpecial)
        if (variantInfo.hasVariants) {
            existingAttributes.has_variants = true
            existingAttributes.variant1_name = variantInfo.variant1Name
            existingAttributes.variant1_values = variantInfo.variant1Values
            existingAttributes.sku_rows = variantInfo.skuRows
            updates.price = variantInfo.skuRows[0]?.price || currentPrice
            updates.special_price = variantInfo.skuRows[0]?.specialPrice || currentSpecial
        }
    }

    const updatedDraftType = computeDraftType({
        raw_name: updates.raw_name || existingDraft.raw_name,
        title: updates.title || existingDraft.title,
        images: updates.images || existingDraft.images,
        category_id: updates.category_id !== undefined ? updates.category_id : existingDraft.category_id,
        description: updates.description !== undefined ? updates.description : existingDraft.description,
        highlights: updates.highlights !== undefined ? updates.highlights : existingDraft.highlights,
        product_link: existingAttributes.product_link,
        status: updates.status || existingDraft.status
    })
    existingAttributes.draft_type = updatedDraftType
    if (updatedDraftType === 'ready' && !input.status && existingDraft.status === 'draft') {
        updates.status = 'generated'
    }

    updates.attributes = existingAttributes

    const { data: updated, error } = await supabase
        .from('daraz_draft_listings')
        .update(updates)
        .eq('id', draftId)
        .select('*')
        .single()

    if (error) throw new Error(error.message)

    return {
        success: true,
        message: `Draft "${updated.raw_name}" updated successfully!`,
        draft: {
            id: updated.id,
            raw_name: updated.raw_name,
            daraz_title: updated.title,
            price: updated.price,
            special_price: updated.special_price,
            category: updated.category_path,
            has_variants: !!updated.attributes?.has_variants,
            variants_count: updated.attributes?.sku_rows?.length || 0,
            product_link: updated.attributes?.product_link || null,
            draft_type: updatedDraftType,
            status: updated.status,
            updated_at: updated.updated_at
        }
    }
}

// ── Delete Product Draft ────────────────────────────────────────────────────

export async function deleteProductDraft(input: DeleteDraftInput) {
    const supabase = await createAdminClient()

    let draftId = input.id
    let draftName = input.raw_name

    if (!draftId && input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('id, raw_name')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(1)
        if (data && data.length > 0) {
            draftId = data[0].id
            draftName = data[0].raw_name
        }
    }

    if (!draftId) {
        throw new Error(`Draft not found to delete: ${input.id || input.raw_name || 'unknown'}`)
    }

    const { error } = await supabase
        .from('daraz_draft_listings')
        .delete()
        .eq('id', draftId)

    if (error) throw new Error(error.message)

    return {
        success: true,
        message: `Draft "${draftName || draftId}" deleted successfully from the database.`,
        deleted_id: draftId
    }
}

// ── Get Draft Details ───────────────────────────────────────────────────────

export async function getDraftDetails(input: GetDraftDetailsInput) {
    const supabase = await createAdminClient()

    let draftId = input.id
    let query = supabase.from('daraz_draft_listings').select('*')

    if (draftId) {
        query = query.eq('id', draftId)
    } else if (input.raw_name) {
        query = query.ilike('raw_name', `%${input.raw_name.trim()}%`).order('created_at', { ascending: false }).limit(1)
    } else {
        throw new Error('Please provide draft "id" or "raw_name"')
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const draft = Array.isArray(data) ? data[0] : data
    if (!draft) throw new Error(`No draft found matching ${draftId || input.raw_name}`)

    const allStores = await listDarazStores()
    const storeNames = (draft.target_stores || []).map((id: string) => allStores.find(s => s.id === id)?.seller_account || id).join(', ')

    const prodLink = draft.attributes?.product_link || null
    const draftType = draft.attributes?.draft_type || computeDraftType({
        raw_name: draft.raw_name,
        title: draft.title,
        images: draft.images,
        category_id: draft.category_id,
        description: draft.description,
        highlights: draft.highlights,
        product_link: prodLink,
        status: draft.status
    })

    // Preload up to 2 images so Claude Desktop/MCP host receives native image content blocks
    let optimizedImages: OptimizedImage[] = []
    if (Array.isArray(draft.images) && draft.images.length > 0) {
        const validUrls = draft.images.filter((u: any) => typeof u === 'string' && u.startsWith('http')).slice(0, 2)
        const loaded = await Promise.all(validUrls.map((u: string) => fetchAndOptimizeImage(u)))
        optimizedImages = loaded.filter(Boolean) as OptimizedImage[]
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const proxyImageUrl = (draft.images && draft.images.length > 0) ? `${baseUrl}/api/daraz/image-proxy?id=${draft.id}&idx=0` : null
    const proxyImages = (draft.images && draft.images.length > 0)
        ? draft.images.map((_: any, idx: number) => `${baseUrl}/api/daraz/image-proxy?id=${draft.id}&idx=${idx}`)
        : []

    return {
        success: true,
        _images: optimizedImages,
        draft: {
            id: draft.id,
            raw_name: draft.raw_name,
            title: draft.title,
            titles_per_store: draft.titles_per_store,
            price: draft.price,
            special_price: draft.special_price,
            category_id: draft.category_id,
            category_path: draft.category_path,
            attributes: draft.attributes,
            variants: draft.attributes?.sku_rows || [],
            has_variants: !!draft.attributes?.has_variants,
            assigned_stores: storeNames,
            description: draft.description,
            highlights: draft.highlights,
            images: proxyImages.length > 0 ? proxyImages : (draft.images || []),
            original_images: draft.images || [],
            proxy_image_url: proxyImageUrl,
            images_loaded_for_vision: optimizedImages.length,
            wholesale_price: draft.wholesale_price,
            supplier_id: draft.supplier_id,
            product_link: prodLink,
            draft_type: draftType,
            status: draft.status,
            created_at: draft.created_at,
            updated_at: draft.updated_at
        }
    }
}

// ── View Draft Images (Dedicated Vision Tool) ───────────────────────────────

export async function viewDraftImages(input: ViewDraftImagesInput) {
    const supabase = await createAdminClient()
    let draft: any = null
    let targetImages: string[] = []

    if (input.image_url) {
        targetImages = [input.image_url]
    } else if (input.id) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', input.id)
            .single()
        draft = data
    } else if (input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(1)
        draft = data?.[0]
    }

    if (draft && Array.isArray(draft.images)) {
        targetImages = draft.images.filter((img: any) => typeof img === 'string' && img.startsWith('http'))
    }

    if (targetImages.length === 0) {
        throw new Error(`No product images found for draft: ${input.id || input.raw_name || 'unknown'}`)
    }

    const limit = Math.min(Math.max(input.max_images || 2, 1), 4)
    const toProcess = targetImages.slice(0, limit)
    const processed = (await Promise.all(toProcess.map(url => fetchAndOptimizeImage(url)))).filter(Boolean) as OptimizedImage[]

    if (processed.length === 0) {
        throw new Error('Failed to load image bytes from the specified URL(s)')
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const proxyImageUrl = draft?.id ? `${baseUrl}/api/daraz/image-proxy?id=${draft.id}&idx=0` : `${baseUrl}/api/daraz/image-proxy?url=${encodeURIComponent(targetImages[0])}`

    return {
        success: true,
        draft_id: draft?.id || null,
        draft_name: draft?.raw_name || null,
        draft_type: draft?.attributes?.draft_type || null,
        proxy_image_url: proxyImageUrl,
        images_count: processed.length,
        _images: processed,
        images: processed.map((p, idx) => ({
            url: draft?.id ? `${baseUrl}/api/daraz/image-proxy?id=${draft.id}&idx=${idx}` : p.url,
            original_url: p.url,
            mimeType: p.mimeType,
            width: p.width,
            height: p.height,
            size_kb: Math.round(p.sizeBytes / 1024),
            data_url: p.dataUrl
        })),
        message: `Successfully loaded ${processed.length} product image(s). Image blocks are attached for vision, and proxy download URLs are provided for local curl.`
    }
}

// ── Bulk Add Products ───────────────────────────────────────────────────────

export async function bulkAddProducts(input: BulkAddInput) {
    if (!input.products || input.products.length === 0) {
        throw new Error('Please provide a non-empty list of products')
    }

    const stores = await resolveTargetStores({
        store_account_name: input.store_account_name,
        store_accounts: input.store_accounts
    })
    const targetStoreIds = stores.map(s => s.id)

    const validItems = input.products
        .filter(p => p.name && p.name.trim().length > 0)
        .map(p => {
            const raw = p.name.trim()
            const pricing = resolvePricing(p.price, p.special_price)
            const title = p.title || `${raw} - High Quality`
            const titlesPerStore: Record<string, string> = {}
            targetStoreIds.forEach(id => { titlesPerStore[id] = title })

            const variantInfo = buildVariantSkuRows(raw, p.variants, pricing.price, pricing.specialPrice)
            const attributesPayload: Record<string, any> = {}
            if (variantInfo.hasVariants) {
                attributesPayload.has_variants = true
                attributesPayload.variant1_name = variantInfo.variant1Name
                attributesPayload.variant1_values = variantInfo.variant1Values
                attributesPayload.sku_rows = variantInfo.skuRows
            }

            return {
                raw_name: raw,
                title,
                titles_per_store: titlesPerStore,
                description: formatDescription(p.description, raw),
                highlights: formatHighlights(p.highlights),
                price: variantInfo.hasVariants && variantInfo.skuRows[0]?.price ? variantInfo.skuRows[0].price : pricing.price,
                special_price: variantInfo.hasVariants && variantInfo.skuRows[0]?.specialPrice ? variantInfo.skuRows[0].specialPrice : pricing.specialPrice,
                wholesale_price: p.wholesale_price || null,
                attributes: attributesPayload,
                images: p.images || [],
                target_stores: targetStoreIds,
                status: 'draft'
            }
        })

    if (validItems.length === 0) {
        throw new Error('No valid products found with names')
    }

    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_draft_listings')
        .insert(validItems)
        .select('id, raw_name, title, price, special_price, status')

    if (error) throw new Error(error.message)

    const storeNames = stores.map(s => s.seller_account).join(', ')

    return {
        success: true,
        message: `Successfully created ${validItems.length} product draft(s) with titles, descriptions and highlights for account(s) "${storeNames}"!`,
        count: validItems.length,
        items: data || []
    }
}

// ── Get Draft Listings ──────────────────────────────────────────────────────

export async function getDraftListings(input: GetDraftsInput = {}) {
    const supabase = await createAdminClient()
    let query = supabase
        .from('daraz_draft_listings')
        .select('id, raw_name, title, titles_per_store, price, special_price, category_id, category_path, status, target_stores, images, attributes, description, highlights, created_at')
        .order('created_at', { ascending: false })
        .limit(input.limit || 50)

    if (input.status && input.status !== 'all') {
        query = query.eq('status', input.status)
    }

    if (input.search && input.search.trim()) {
        query = query.ilike('raw_name', `%${input.search.trim()}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const mapped = (data || []).map(d => {
        const prodLink = d.attributes?.product_link || null
        const draftType = d.attributes?.draft_type || computeDraftType({
            raw_name: d.raw_name,
            title: d.title,
            images: d.images,
            category_id: d.category_id,
            description: d.description,
            highlights: d.highlights,
            product_link: prodLink,
            status: d.status
        })

        const proxyImageUrl = (d.images && d.images.length > 0) ? `${baseUrl}/api/daraz/image-proxy?id=${d.id}&idx=0` : null
        const proxyImages = (d.images && d.images.length > 0)
            ? d.images.map((_: any, idx: number) => `${baseUrl}/api/daraz/image-proxy?id=${d.id}&idx=${idx}`)
            : []

        return {
            id: d.id,
            raw_name: d.raw_name,
            title: d.title,
            titles_per_store: d.titles_per_store,
            price: d.price,
            special_price: d.special_price,
            category_id: d.category_id,
            category_path: d.category_path,
            status: d.status,
            target_stores: d.target_stores,
            images: proxyImages.length > 0 ? proxyImages : (d.images || []),
            original_images: d.images || [],
            proxy_image_url: proxyImageUrl,
            product_link: prodLink,
            draft_type: draftType,
            has_description: Boolean(d.description && d.description.trim().length > 0),
            has_highlights: Boolean(d.highlights && d.highlights.length > 0),
            created_at: d.created_at
        }
    })

    const filtered = (input.type && input.type !== 'all')
        ? mapped.filter(d => {
            if (input.type === 'pending') {
                return d.draft_type === 'pending' || d.draft_type === 'image_only' || d.draft_type === 'link_only' || d.draft_type === 'name_only'
            }
            return d.draft_type === input.type
        })
        : mapped

    return {
        success: true,
        total: filtered.length,
        drafts: filtered
    }
}

export async function extractProductLinkAction(url: string) {
    return await extractCompetitorProduct(url)
}

// ── Push Product to Daraz ───────────────────────────────────────────────────

export async function pushProductToDaraz(input: PushProductInput) {
    const stores = await resolveTargetStores({
        store_account_name: input.store_account_name,
        store_accounts: input.store_accounts
    })
    if (stores.length === 0) {
        throw new Error('No active Daraz store found. Please connect a Daraz seller account first.')
    }
    const store = stores[0]

    const supabase = await createAdminClient()

    // 1. Resolve pricing & variants
    const pricing = resolvePricing(input.price, input.special_price)
    const variantInfo = buildVariantSkuRows(input.product_name, input.variants, pricing.price, pricing.specialPrice)

    const title = input.title || `${input.product_name} - Premium Quality`
    const titlesPerStore: Record<string, string> = { [store.id]: title }
    const description = formatDescription(input.description, input.product_name)
    const highlights = formatHighlights(input.highlights)

    // 2. Resolve Images: Clean URLs and fallback to existing draft if images were previously saved
    let resolvedImages = (input.images || []).map(cleanImageUrl).filter(Boolean)
    if (resolvedImages.length === 0) {
        const { data: existingDraft } = await supabase
            .from('daraz_draft_listings')
            .select('images, attributes, category_id, category_path')
            .ilike('raw_name', input.product_name)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existingDraft?.images && Array.isArray(existingDraft.images) && existingDraft.images.length > 0) {
            resolvedImages = existingDraft.images.map(cleanImageUrl).filter(Boolean)
        }
        if (!input.category_id && existingDraft?.category_id) {
            input.category_id = existingDraft.category_id
        }
        if (!input.category_path && existingDraft?.category_path) {
            input.category_path = existingDraft.category_path
        }
    }

    const hasImages = resolvedImages.length > 0
    if (!hasImages) {
        const attributesPayload: Record<string, any> = { ...(input.attributes || {}) }
        if (variantInfo.hasVariants) {
            attributesPayload.has_variants = true
            attributesPayload.variant1_name = variantInfo.variant1Name
            attributesPayload.variant1_values = variantInfo.variant1Values
            attributesPayload.sku_rows = variantInfo.skuRows
        }

        const { data: draft, error: draftErr } = await supabase
            .from('daraz_draft_listings')
            .insert({
                raw_name: input.product_name,
                title,
                titles_per_store: titlesPerStore,
                price: pricing.price,
                special_price: pricing.specialPrice,
                target_stores: [store.id],
                category_id: input.category_id || null,
                category_path: input.category_path || null,
                attributes: attributesPayload,
                description,
                highlights,
                status: 'generated'
            })
            .select('id, raw_name, title, status')
            .single()

        if (draftErr) throw new Error(draftErr.message)

        return {
            success: true,
            status: 'draft_ready_for_images',
            store: store.seller_account,
            draft_id: draft.id,
            message: `Product "${input.product_name}" saved as "${draft.title}" for store "${store.seller_account}". Note: Daraz requires at least 1 product image before publishing to the live marketplace. The draft is saved as "Ready" in your webapp drafts list—upload an image there or pass an image URL to push to Daraz.`
        }
    }

    // 3. Resolve Category
    let categoryId = input.category_id
    let categoryPath = input.category_path || input.category_name || input.category

    if (!categoryId || (categoryId === 10520 && !input.product_name.toLowerCase().includes('car'))) {
        try {
            const best = await resolveBestCategory(input.product_name, categoryPath)
            if (best) {
                categoryId = best.id
                categoryPath = best.path
            }
        } catch (catErr: any) {
            console.warn('[ClaudeConnector] Category resolve error in push:', catErr.message)
        }
    }

    // 4. Construct SKUs for Daraz API
    const finalSkus = (variantInfo.hasVariants && variantInfo.skuRows.length > 0)
        ? variantInfo.skuRows.map(row => ({
            sellerSku: row.sellerSku,
            price: row.price,
            specialPrice: row.specialPrice,
            quantity: row.quantity || 100,
            packageWeight: 0.1,
            packageLength: 1,
            packageWidth: 1,
            packageHeight: 1,
            images: row.images?.length > 0 ? row.images.map(cleanImageUrl) : resolvedImages,
            colorFamily: row.variant1
        }))
        : [{
            price: pricing.price,
            specialPrice: pricing.specialPrice,
            quantity: 100,
            packageWeight: 0.1,
            packageLength: 1,
            packageWidth: 1,
            packageHeight: 1,
            images: resolvedImages
        }]

    // 5. Push to Daraz API
    let existingDraftId: string | null = null
    try {
        const { data: existingDrafts } = await supabase
            .from('daraz_draft_listings')
            .select('id')
            .ilike('raw_name', input.product_name.trim())
            .order('created_at', { ascending: false })
            .limit(1)

        if (existingDrafts && existingDrafts.length > 0) {
            existingDraftId = existingDrafts[0].id
        }
    } catch (e: any) {
        console.warn('[ClaudeConnector] Could not check existing draft:', e.message)
    }

    try {
        const createRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/daraz/products/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeIds: [store.id],
                primaryCategory: categoryId,
                name: title,
                rawName: input.product_name,
                titlesPerStore,
                shortDescription: highlights.join('\n'),
                description,
                brand: input.brand || 'No Brand',
                attributes: input.attributes || {},
                skus: finalSkus,
                images: resolvedImages
            })
        })

        const result = await createRes.json()

        const attributesPayload: Record<string, any> = { ...(input.attributes || {}) }
        if (variantInfo.hasVariants) {
            attributesPayload.has_variants = true
            attributesPayload.variant1_name = variantInfo.variant1Name
            attributesPayload.variant1_values = variantInfo.variant1Values
            attributesPayload.sku_rows = variantInfo.skuRows
        }

        // Check if all store pushes failed
        const successfulList = (result.results || []).filter((r: any) => r.success)
        const isFailed = !createRes.ok || !result.success || successfulList.length === 0
        const firstError = result.results?.find((r: any) => !r.success)?.error || result.error || 'Failed to push to Daraz'

        if (isFailed) {
            const failPayload = {
                raw_name: input.product_name,
                title,
                titles_per_store: titlesPerStore,
                price: pricing.price,
                special_price: pricing.specialPrice,
                target_stores: [store.id],
                category_id: categoryId,
                category_path: categoryPath,
                attributes: attributesPayload,
                images: input.images || [],
                description,
                highlights,
                status: 'failed',
                error: firstError,
                updated_at: new Date().toISOString()
            }

            if (existingDraftId) {
                await supabase.from('daraz_draft_listings').update(failPayload).eq('id', existingDraftId)
            } else {
                await supabase.from('daraz_draft_listings').insert(failPayload)
            }

            return {
                success: false,
                store: store.seller_account,
                error: firstError,
                message: `Failed to push "${title}" to Daraz: ${firstError}. Marked as failed in drafts.`
            }
        }

        const successPayload = {
            raw_name: input.product_name,
            title,
            titles_per_store: titlesPerStore,
            price: pricing.price,
            special_price: pricing.specialPrice,
            target_stores: [store.id],
            category_id: categoryId,
            category_path: categoryPath,
            attributes: attributesPayload,
            images: input.images || [],
            description,
            highlights,
            status: 'pushed',
            error: null,
            updated_at: new Date().toISOString()
        }

        if (existingDraftId) {
            await supabase.from('daraz_draft_listings').update(successPayload).eq('id', existingDraftId)
        } else {
            await supabase.from('daraz_draft_listings').insert(successPayload)
        }

        return {
            success: true,
            status: 'pushed',
            store: store.seller_account,
            message: `Successfully pushed "${title}" (Special Rs. ${pricing.specialPrice}, Regular Rs. ${pricing.price}) to Daraz seller account "${store.seller_account}"!`,
            details: result
        }

    } catch (err: any) {
        if (existingDraftId) {
            try {
                await supabase.from('daraz_draft_listings').update({
                    status: 'failed',
                    error: err.message,
                    updated_at: new Date().toISOString()
                }).eq('id', existingDraftId)
            } catch {}
        }
        return {
            success: false,
            store: store.seller_account,
            error: err.message,
            message: `Error pushing to Daraz: ${err.message}`
        }
    }
}

// ── Search Daraz Categories ──────────────────────────────────────────────────

export async function searchDarazCategoriesAction(query: string, limit: number = 6) {
    const results = await searchDarazCategories(query, limit)
    return {
        success: true,
        count: results.length,
        categories: results.map(r => ({
            category_id: r.id,
            name: r.name,
            category_path: r.path
        }))
    }
}
