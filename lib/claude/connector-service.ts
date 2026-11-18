/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/server'
import { cleanImageUrl } from '@/lib/daraz/image-migrate'
import { resolveBestCategory, searchDarazCategories, getDarazLeafCategories } from '@/lib/daraz/category-service'
import { extractCompetitorProduct } from '@/lib/daraz/link-extractor'
import { fetchAndOptimizeImage, OptimizedImage } from './image-helper'
import {
    calculateDarazFeeBreakdown,
    calculateExactBreakevenPrice,
    DEFAULT_OTHER_FEES,
    type OtherFeeItem
} from '@/features/sales/utils/daraz-fee-calculator'
import { getConnectorScope } from './connector-scope'
import {
    filterStoresForScope,
    filterVisibleDrafts,
    isDraftVisible,
    mergeTargetStoresForScope,
    signInternalUser
} from '@/lib/daraz/listing-access'
import axios from 'axios'

function assertConnectorCanEdit() {
    const scope = getConnectorScope()
    if (scope && scope.restricted && !scope.canEdit) {
        throw new Error('Permission denied: your staff account has view-only access to Daraz Listing.')
    }
    if (scope && scope.restricted && scope.allowedStoreIds.length === 0) {
        throw new Error('Permission denied: your staff account has no active Daraz seller accounts assigned.')
    }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface ViewDraftImagesInput {
    id?: string
    draft_id?: string
    raw_name?: string
    image_url?: string
    max_images?: number
    analyze_with_vision?: boolean
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
    values?: string[]
    price?: number
    special_price?: number
    stock?: number
    quantity?: number
    seller_sku?: string
    images?: string[]
}

export interface SaveDraftInput {
    raw_name?: string
    title?: string
    titles_per_store?: Record<string, string>
    description?: string
    descriptions_per_store?: Record<string, string>
    highlights?: string[] | string
    highlights_per_store?: Record<string, string[] | string>
    price?: number
    special_price?: number
    campaign_price?: number
    mrp_price?: number
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    category_name?: string
    category?: string
    confirm_category?: boolean
    attributes?: Record<string, any>
    variants?: VariantItemInput[] | string[]
    images?: string[]
    supplier_id?: string
    supplier_name?: string
    confirm_supplier?: boolean
    wholesale_price?: number
    product_link?: string
    include_image_in_description?: boolean
    description_image_url?: string
    generate_studio_images?: boolean
    image_prompt?: string
    studio_slots?: number[]
    replace_existing_images?: boolean
    delete_old_images?: boolean
    delete_image_indices?: number[]
    delete_image_urls?: string[]
}

export interface UpdateDraftInput {
    id?: string
    draft_id?: string
    raw_name?: string
    title?: string
    titles_per_store?: Record<string, string>
    description?: string
    descriptions_per_store?: Record<string, string>
    highlights?: string[] | string
    highlights_per_store?: Record<string, string[] | string>
    price?: number
    special_price?: number
    campaign_price?: number
    mrp_price?: number
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    category_name?: string
    category?: string
    confirm_category?: boolean
    attributes?: Record<string, any>
    variants?: VariantItemInput[] | string[]
    images?: string[]
    supplier_id?: string
    supplier_name?: string
    confirm_supplier?: boolean
    wholesale_price?: number
    product_link?: string
    include_image_in_description?: boolean
    description_image_url?: string
    generate_studio_images?: boolean
    image_prompt?: string
    studio_slots?: number[]
    replace_existing_images?: boolean
    delete_old_images?: boolean
    delete_image_indices?: number[]
    delete_image_urls?: string[]
    status?: 'draft' | 'generating' | 'generated' | 'pushing' | 'pushed' | 'failed'
}

export interface DeleteDraftInput {
    id?: string
    draft_id?: string
    raw_name?: string
}

export interface GetDraftDetailsInput {
    id?: string
    draft_id?: string
    raw_name?: string
}

export interface BulkAddProductItem {
    name: string
    title?: string
    description?: string
    highlights?: string[]
    price?: number
    special_price?: number
    campaign_price?: number
    mrp_price?: number
    wholesale_price?: number
    supplier_id?: string
    supplier_name?: string
    variants?: VariantItemInput[] | string[]
    images?: string[]
}

export interface BulkAddInput {
    products: BulkAddProductItem[]
    store_account_name?: string
    store_accounts?: string[]
}

export interface PushProductInput {
    id?: string
    draft_id?: string
    product_name?: string
    title?: string
    titles_per_store?: Record<string, string>
    price?: number
    special_price?: number
    campaign_price?: number
    mrp_price?: number
    wholesale_price?: number
    supplier_id?: string
    supplier_name?: string
    confirm_supplier?: boolean
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    category_name?: string
    category?: string
    confirm_category?: boolean
    attributes?: Record<string, any>
    variants?: VariantItemInput[] | string[]
    images?: string[]
    description?: string
    descriptions_per_store?: Record<string, string>
    include_image_in_description?: boolean
    description_image_url?: string
    highlights?: string[] | string
    highlights_per_store?: Record<string, string[] | string>
    brand?: string
}

export interface CalculateDarazProfitInput {
    draft_id?: string
    raw_name?: string
    product_name?: string
    category_id?: number
    category_path?: string
    category_name?: string
    category?: string
    confirm_category?: boolean
    selling_price?: number
    special_price?: number
    wholesale_price?: number
    packaging_cost?: number
    campaign_price?: number
    mrp_price?: number
    target_profit?: number
    target_margin_percent?: number
    commission_rate?: number
}

export interface GenerateStudioImagesInput {
    id?: string
    draft_id?: string
    raw_name?: string
    image_url?: string
    source_image_url?: string
    images?: string[]
    image_urls?: string[]
    images_base64?: string[]
    base64_image?: string
    image_prompt?: string
    product_name?: string
    category_path?: string
    price?: number
    slots?: number[]
    replace_existing_images?: boolean
    delete_old_images?: boolean
    delete_image_indices?: number[]
    delete_image_urls?: string[]
    include_image_in_description?: boolean
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
    const scope = getConnectorScope()
    return scope ? filterStoresForScope(scope, stores || []) : (stores || [])
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

    const scope = getConnectorScope()
    if (scope?.restricted) {
        throw new Error(`Permission denied: seller account "${accountNameOrId}" is not in your permitted stores [${stores.map(s => s.seller_account).join(', ')}].`)
    }

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
        return allStores.slice(0, 1) // default to first allowed store
    }

    if (queryList.some(q => q.toLowerCase() === 'all' || q.toLowerCase() === 'all stores')) {
        return allStores
    }

    const scope = getConnectorScope()
    const matched: StoreAccountInfo[] = []
    const unmatched: string[] = []

    for (const q of queryList) {
        const term = q.toLowerCase()
        const found = allStores.find(s =>
            s.seller_account.toLowerCase().includes(term) ||
            term.includes(s.seller_account.toLowerCase()) ||
            s.id.toLowerCase() === term
        )
        if (found) {
            if (!matched.some(m => m.id === found.id)) {
                matched.push(found)
            }
        } else {
            unmatched.push(q)
        }
    }

    if (scope?.restricted && unmatched.length > 0) {
        throw new Error(
            `Permission denied: you do not have access to seller account(s) "${unmatched.join(', ')}". Your permitted seller account(s): [${allStores.map(s => s.seller_account).join(', ')}].`
        )
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
 * - Supports both flat lists (["Black", "Red"] or [{ name: "Black", price: 450 }])
 *   and OpenAPI nested groups ([{ name: "Color", values: ["Black", "Red"], price: 550, special_price: 450 }])
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
    let detectedVariant1Name = 'Color Family'

    const rawList = Array.isArray(variantsInput) ? variantsInput : [variantsInput]

    // Expand OpenAPI nested format { name: "Color", values: ["Black", "Red"], price, special_price, quantity }
    const expandedList: any[] = []
    rawList.forEach(entry => {
        if (entry && typeof entry === 'object' && Array.isArray(entry.values) && entry.values.length > 0) {
            if (entry.name && typeof entry.name === 'string') {
                detectedVariant1Name = entry.name
            }
            entry.values.forEach((val: any) => {
                expandedList.push({
                    name: String(val || '').trim(),
                    price: entry.price,
                    special_price: entry.special_price,
                    stock: entry.quantity ?? entry.stock,
                    seller_sku: entry.seller_sku,
                    images: entry.images
                })
            })
        } else {
            expandedList.push(entry)
        }
    })

    expandedList.forEach((v, i) => {
        let varName = ''
        let varSpecial = defaultSpecialPrice
        let varPrice = defaultPrice
        let varStock = 100
        let varSku = ''
        let varImages: string[] = []

        if (typeof v === 'string') {
            varName = v.trim()
        } else if (v && typeof v === 'object') {
            varName = (v.color || v.colorFamily || v.variant1 || v.name || v.size || `Variant ${i + 1}`).trim()
            if (v.special_price || v.specialPrice) {
                varSpecial = Number(v.special_price ?? v.specialPrice)
                varPrice = Number(v.price) || Math.max(Math.round((varSpecial * 1.25) / 10) * 10, varSpecial + 100)
            } else if (v.price) {
                varSpecial = Number(v.price)
                varPrice = Math.max(Math.round((varSpecial * 1.25) / 10) * 10, varSpecial + 100)
            }
            const rawStock = v.stock ?? v.quantity
            varStock = (rawStock !== undefined && rawStock !== null) ? Number(rawStock) : 100
            varSku = v.seller_sku || v.sellerSku || ''
            varImages = Array.isArray(v.images) ? v.images : []
        }

        if (!varName) return

        variant1Values.push(varName)
        const varSlug = varName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const randomDigits = Math.floor(1000 + Math.random() * 9000)
        const finalSku = varSku || `${slug.toUpperCase()}-${varSlug.toUpperCase()}-${randomDigits}`

        items.push({
            variant1: varName,
            colorFamily: varName,
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
        variant1Name: detectedVariant1Name,
        variant1Values,
        skuRows: items
    }
}

/**
 * Ensures all highlights start with bullet point '• ' without stripping leading product numbers (e.g. "250g pack...", "100% cotton...")
 */
export function formatHighlights(rawHighlights: any): string[] {
    const stripBulletOrListPrefix = (s: string) =>
        String(s)
            .trim()
            .replace(/^(?:[•*+\-–—]\s*|\d{1,2}[.)]\s+)+/, '')
            .trim()

    let list: string[] = []
    if (Array.isArray(rawHighlights)) {
        list = rawHighlights
            .map(h => stripBulletOrListPrefix(h))
            .filter(Boolean)
    } else if (typeof rawHighlights === 'string' && rawHighlights.trim()) {
        list = rawHighlights
            .split(/\r?\n/)
            .map(line => stripBulletOrListPrefix(line))
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
 * Formats description with clean paragraphs, bold formatting, and optional embedded product image for Daraz
 */
export function formatDescription(desc?: string, rawName?: string, embedImageUrl?: string | null): string {
    let d = ''
    if (!desc || !desc.trim()) {
        d = `<p><strong>${rawName || 'Product'}</strong></p>\n<p>High quality product designed for reliable everyday use, durability, and superior performance.</p>`
    } else {
        d = desc.trim()
        // Convert markdown **bold** into <strong>bold</strong>
        d = d.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert markdown ![alt](url) into <img src="url" alt="alt" />
        d = d.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<p><img src="$2" alt="$1" style="max-width:100%;height:auto;" /></p>')
        // If it lacks basic HTML tags, wrap paragraphs cleanly
        if (!d.includes('<p>') && !d.includes('<div>') && !d.includes('<ul>')) {
            d = d
                .split(/\r?\n\r?\n/)
                .map(para => `<p>${para.trim().replace(/\r?\n/g, '<br/>')}</p>`)
                .join('\n')
        }
    }

    if (embedImageUrl && typeof embedImageUrl === 'string' && embedImageUrl.startsWith('http') && !d.includes(embedImageUrl)) {
        d += `\n<p><img src="${embedImageUrl}" alt="${(rawName || 'Product').replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;display:block;margin:12px auto;" /></p>`
    }

    return d
}

// ── Supplier Matching, Pricing DB Sync & Profit Helpers ─────────────────────

function levenshteinDistance(a: string, b: string): number {
    const s = a.toLowerCase().trim()
    const t = b.toLowerCase().trim()
    if (s === t) return 0
    if (s.length === 0) return t.length
    if (t.length === 0) return s.length
    const matrix: number[][] = []
    for (let i = 0; i <= t.length; i++) matrix[i] = [i]
    for (let j = 0; j <= s.length; j++) matrix[0][j] = j
    for (let i = 1; i <= t.length; i++) {
        for (let j = 1; j <= s.length; j++) {
            const cost = t.charAt(i - 1) === s.charAt(j - 1) ? 0 : 1
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            )
        }
    }
    return matrix[t.length][s.length]
}

export async function resolveSupplierByNameOrId(input: {
    supplier_id?: string
    supplier_name?: string
    confirm_supplier?: boolean
}): Promise<{
    supplierId: string | null
    supplierName: string | null
    needsConfirmation: boolean
    candidates: Array<{ id: string; supplier_name: string }>
    message: string
}> {
    const supabase = await createAdminClient()

    if (input.supplier_id && input.supplier_id.trim()) {
        const { data } = await supabase
            .from('suppliers')
            .select('id, supplier_name')
            .eq('id', input.supplier_id.trim())
            .maybeSingle()
        if (data) {
            return { supplierId: data.id, supplierName: data.supplier_name, needsConfirmation: false, candidates: [], message: `Matched supplier "${data.supplier_name}".` }
        }
    }

    const rawQuery = (input.supplier_name || '').trim()
    if (!rawQuery) {
        return { supplierId: null, supplierName: null, needsConfirmation: false, candidates: [], message: '' }
    }

    const { data: allSuppliers } = await supabase
        .from('suppliers')
        .select('id, supplier_name')
        .eq('is_deleted', false)
        .order('supplier_name', { ascending: true })

    const suppliers = allSuppliers || []
    const qLower = rawQuery.toLowerCase()

    // 1. Exact case-insensitive match
    const exactMatch = suppliers.find(s => (s.supplier_name || '').trim().toLowerCase() === qLower)
    if (exactMatch) {
        return {
            supplierId: exactMatch.id,
            supplierName: exactMatch.supplier_name,
            needsConfirmation: false,
            candidates: [],
            message: `Exact supplier match found: "${exactMatch.supplier_name}".`
        }
    }

    // 2. Fuzzy / partial match (e.g. "Ram" -> "Ramu", "Ram Traders")
    const scored = suppliers
        .map(s => {
            const name = (s.supplier_name || '').trim()
            const sLower = name.toLowerCase()
            const firstWord = sLower.split(/\s+/)[0] || sLower
            const distFull = levenshteinDistance(qLower, sLower)
            const distFirst = levenshteinDistance(qLower, firstWord)
            const maxLen = Math.max(qLower.length, firstWord.length, 1)
            const similarity = 1 - (distFirst / maxLen)

            let score = 0
            if (sLower.startsWith(qLower) || qLower.startsWith(sLower)) score += 90
            else if (firstWord.startsWith(qLower) || qLower.startsWith(firstWord)) score += 80
            else if (sLower.includes(qLower) || qLower.includes(sLower)) score += 70

            if (distFirst <= 2) score += (60 - distFirst * 15)
            else if (distFull <= 3) score += (45 - distFull * 10)
            else if (similarity >= 0.6) score += Math.round(similarity * 50)

            return { id: s.id, supplier_name: name, score }
        })
        .filter(item => item.score >= 35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

    // If user explicitly passed confirm_supplier=true and there's a top candidate, accept it
    if (input.confirm_supplier && scored.length > 0) {
        return {
            supplierId: scored[0].id,
            supplierName: scored[0].supplier_name,
            needsConfirmation: false,
            candidates: [],
            message: `Confirmed supplier "${scored[0].supplier_name}".`
        }
    }

    const candidates = scored.map(({ id, supplier_name }) => ({ id, supplier_name }))
    const msg = candidates.length > 0
        ? `No exact supplier named "${rawQuery}" was found in the database, but found similar supplier(s): ${candidates.map(c => `"${c.supplier_name}" (ID: ${c.id})`).join(', ')}. Please ask the user: "Is '${candidates[0].supplier_name}' the supplier?" and call again with supplier_id="${candidates[0].id}" or confirm_supplier=true.`
        : `No supplier matching "${rawQuery}" was found in the database. Please ask the user for the exact supplier name or call without supplier_name.`

    return {
        supplierId: null,
        supplierName: null,
        needsConfirmation: true,
        candidates,
        message: msg
    }
}

export async function searchSuppliersAction(query?: string) {
    const supabase = await createAdminClient()
    const dbQuery = supabase
        .from('suppliers')
        .select('id, supplier_name, phone, address')
        .eq('is_deleted', false)
        .order('supplier_name', { ascending: true })
        .limit(50)

    const { data, error } = await dbQuery
    if (error) throw new Error(error.message)

    const list = data || []
    if (!query || !query.trim()) {
        return { success: true, count: list.length, suppliers: list }
    }

    const resolved = await resolveSupplierByNameOrId({ supplier_name: query })
    if (resolved.supplierId) {
        return {
            success: true,
            exact_match: true,
            matched_supplier: { id: resolved.supplierId, supplier_name: resolved.supplierName },
            suppliers: [{ id: resolved.supplierId, supplier_name: resolved.supplierName }]
        }
    }

    return {
        success: true,
        exact_match: false,
        needs_confirmation: true,
        query,
        suggested_suppliers: resolved.candidates,
        message: resolved.candidates.length > 0
            ? `No exact match for "${query}". Did you mean: ${resolved.candidates.map(c => `"${c.supplier_name}"`).join(', ')}? Please confirm with the user.`
            : `No supplier found matching "${query}".`
    }
}

/**
 * Syncs supplier wholesale price, market/sales price, campaign price, and MRP price
 * into inventory tables if the product exists in `products`.
 */
async function syncPricingAndSupplierToInventoryTables(params: {
    rawName?: string
    productName?: string
    supplierId?: string | null
    wholesalePrice?: number | null
    specialPrice?: number | null
    sellingPrice?: number | null
    regularPrice?: number | null
    campaignPrice?: number | null
    mrpPrice?: number | null
    imageUrl?: string | null
}) {
    try {
        const cleanName = (params.rawName || params.productName || '').trim()
        const effectiveSpecialPrice = params.specialPrice ?? params.sellingPrice
        if (!cleanName || cleanName.startsWith('[Image Only]') || cleanName.startsWith('[Link]')) return

        const supabase = await createAdminClient()
        const { data: existingProd } = await supabase
            .from('products')
            .select('id, product_name')
            .ilike('product_name', cleanName)
            .eq('is_deleted', false)
            .maybeSingle()

        const productId = existingProd?.id || null

        if (productId) {
            const prodUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
            if (effectiveSpecialPrice && effectiveSpecialPrice > 0) prodUpdates.special_price = Number(effectiveSpecialPrice)
            if (params.regularPrice && params.regularPrice > 0) prodUpdates.regular_price = Number(params.regularPrice)
            if (Object.keys(prodUpdates).length > 1) {
                await supabase.from('products').update(prodUpdates).eq('id', productId)
            }

            if (params.supplierId && params.wholesalePrice && Number(params.wholesalePrice) > 0) {
                await supabase.from('product_wholesale_prices').insert({
                    product_id: productId,
                    supplier_id: params.supplierId,
                    wholesale_price: Number(params.wholesalePrice)
                })
            }

            if ((effectiveSpecialPrice && effectiveSpecialPrice > 0) || (params.campaignPrice && params.campaignPrice > 0)) {
                const avgPayload: Record<string, any> = {
                    product_id: productId,
                    updated_at: new Date().toISOString()
                }
                if (effectiveSpecialPrice && effectiveSpecialPrice > 0) avgPayload.market_price = Number(effectiveSpecialPrice)
                if (params.campaignPrice && params.campaignPrice > 0) avgPayload.campaign_price = Number(params.campaignPrice)
                await supabase.from('daraz_avg_prices').upsert(avgPayload, { onConflict: 'product_id' })
            }
        }

        if (params.mrpPrice && Number(params.mrpPrice) > 0) {
            await supabase.from('mrp_prices').insert({
                product_name: cleanName,
                inventory_id: productId,
                mrp_price: Number(params.mrpPrice),
                applied_date: new Date().toISOString().split('T')[0]
            })
        }
    } catch (err: any) {
        console.warn('[ClaudeConnector] Inventory pricing sync notice:', err.message)
    }
}

export async function calculateDarazProfitAction(input: CalculateDarazProfitInput) {
    const supabase = await createAdminClient()
    let categoryPath = (input.category_path || '').trim()
    let wholesale = Number(input.wholesale_price || 0)
    let sellingPrice = Number(input.special_price || input.selling_price || 0)
    let productName = input.product_name || input.raw_name || ''

    if (input.draft_id) {
        const { data: draftRow } = await supabase
            .from('daraz_draft_listings')
            .select('raw_name, title, category_path, price, special_price, wholesale_price, target_stores, attributes')
            .eq('id', input.draft_id)
            .maybeSingle()
        const scope = getConnectorScope()
        if (draftRow && (!scope || isDraftVisible(scope, draftRow))) {
            if (!categoryPath && draftRow.category_path) categoryPath = draftRow.category_path
            if (!wholesale && draftRow.wholesale_price) wholesale = Number(draftRow.wholesale_price)
            if (!sellingPrice && (draftRow.special_price || draftRow.price)) sellingPrice = Number(draftRow.special_price || draftRow.price)
            if (!productName) productName = draftRow.raw_name || draftRow.title || ''
        }
    }

    if (!categoryPath && productName) {
        try {
            const best = await resolveBestCategory(productName, undefined)
            if (best?.path) categoryPath = best.path
        } catch { }
    }

    let commissionRate = input.commission_rate
    if (commissionRate === undefined || commissionRate === null) {
        commissionRate = 12.0 // default fallback
        if (categoryPath) {
            const leaf = categoryPath.split('>').pop()?.trim() || categoryPath
            const { data: commRow } = await supabase
                .from('daraz_category_commissions')
                .select('commission_rate, category_path, leaf_category')
                .or(`category_path.ilike.%${leaf}%,leaf_category.ilike.%${leaf}%`)
                .limit(1)
                .maybeSingle()
            if (commRow && commRow.commission_rate !== undefined && commRow.commission_rate !== null) {
                commissionRate = Number(commRow.commission_rate)
            }
        }
    }

    const { data: feeRows } = await supabase
        .from('daraz_other_fees')
        .select('*')
        .eq('is_active', true)

    const otherFees: OtherFeeItem[] = (feeRows && feeRows.length > 0) ? (feeRows as OtherFeeItem[]) : DEFAULT_OTHER_FEES

    const packaging = Number(input.packaging_cost || 0)
    const totalCost = wholesale + packaging

    const breakevenPrice = totalCost > 0
        ? calculateExactBreakevenPrice({
            purchasingPrice: totalCost,
            categoryCommissionRate: commissionRate,
            otherFees
        })
        : null

    let targetProfitAmount = input.target_profit !== undefined ? Number(input.target_profit) : null
    if (targetProfitAmount === null && input.target_margin_percent !== undefined && totalCost > 0) {
        targetProfitAmount = (totalCost * Number(input.target_margin_percent)) / 100
    } else if (targetProfitAmount === null && totalCost > 0) {
        targetProfitAmount = Math.max(Math.round(totalCost * 0.25), 50)
    }

    const recommendedSpecialPrice = (totalCost > 0 && targetProfitAmount !== null)
        ? Math.ceil(calculateExactBreakevenPrice({
            purchasingPrice: totalCost + targetProfitAmount,
            categoryCommissionRate: commissionRate,
            otherFees
        }) / 5) * 5
        : null

    const effectiveEvalPrice = sellingPrice > 0 ? sellingPrice : (recommendedSpecialPrice || 0)
    const breakdown = effectiveEvalPrice > 0
        ? calculateDarazFeeBreakdown({
            salesPrice: effectiveEvalPrice,
            categoryCommissionRate: commissionRate,
            otherFees
        })
        : null

    const netProfit = (breakdown && totalCost > 0)
        ? parseFloat((breakdown.netPayout - totalCost).toFixed(2))
        : null

    const recommendedPricing = effectiveEvalPrice > 0 ? resolvePricing(input.mrp_price, effectiveEvalPrice) : null

    return {
        success: true,
        category_path: categoryPath || 'General (Default 12% Commission)',
        commission_rate_percent: commissionRate,
        effective_commission_with_vat_percent: parseFloat((commissionRate * 1.13).toFixed(2)),
        wholesale_price: wholesale || null,
        evaluated_selling_price: effectiveEvalPrice || null,
        breakeven_minimum_safe_price: breakevenPrice,
        recommended_special_price: recommendedSpecialPrice,
        recommended_regular_mrp_price: recommendedPricing?.price || null,
        net_receivable_payout: breakdown ? parseFloat(breakdown.netPayout.toFixed(2)) : null,
        total_daraz_deduction: breakdown ? parseFloat(breakdown.totalDeduction.toFixed(2)) : null,
        net_profit: netProfit,
        is_profitable: netProfit !== null ? netProfit > 0 : null,
        fee_breakdown: breakdown ? {
            commission_fee_with_vat: parseFloat(breakdown.totalCommissionFee.toFixed(2)),
            handling_fee_with_vat: breakdown.handlingFeeDetail?.totalFee ?? 0,
            handling_bracket: breakdown.handlingFeeDetail?.bracketLabel ?? null,
            other_fees_total: parseFloat(breakdown.otherFeesTotal.toFixed(2)),
            total_deduction: parseFloat(breakdown.totalDeduction.toFixed(2))
        } : null
    }
}

/**
 * Helper to delete old images from a draft and optionally from Supabase 'mobile-captures' storage
 */
async function removeImagesFromStorageIfOwned(supabase: any, urlsToRemove: string[]) {
    if (!urlsToRemove || urlsToRemove.length === 0) return
    const bucketMarker = '/storage/v1/object/public/mobile-captures/'
    const fileNames = urlsToRemove
        .filter(u => typeof u === 'string' && u.includes(bucketMarker))
        .map(u => decodeURIComponent(u.split(bucketMarker)[1]?.split('?')[0] || ''))
        .filter(Boolean)

    if (fileNames.length > 0) {
        try {
            await supabase.storage.from('mobile-captures').remove(fileNames)
        } catch (e: any) {
            console.warn('[ClaudeConnector] Storage cleanup notice:', e.message)
        }
    }
}

/**
 * Downloads external image URLs or decodes base64 image strings, converts them to
 * clean 1000x1000 Daraz-ready studio JPEGs via sharp, and uploads them to Supabase 'mobile-captures'.
 */
async function downloadAndUploadImagesToSupabase(
    supabase: any,
    rawInputs: string[],
    prefix: string = 'ai_uploaded'
): Promise<string[]> {
    const uploadedUrls: string[] = []
    if (!Array.isArray(rawInputs) || rawInputs.length === 0) return uploadedUrls

    let sharpMod: any = null
    try {
        const m = await import('sharp')
        sharpMod = m.default || m
    } catch { }

    for (const rawItem of rawInputs) {
        if (!rawItem || typeof rawItem !== 'string') continue
        const trimmed = rawItem.trim()
        if (!trimmed) continue

        // Already hosted in our own Supabase mobile-captures bucket
        if (trimmed.includes('/storage/v1/object/public/mobile-captures/')) {
            uploadedUrls.push(trimmed)
            continue
        }

        try {
            let rawBuffer: Buffer | null = null

            if (trimmed.startsWith('data:image/')) {
                const b64Part = trimmed.split(',')[1] || ''
                if (b64Part) rawBuffer = Buffer.from(b64Part, 'base64')
            } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && trimmed.length > 150) {
                rawBuffer = Buffer.from(trimmed, 'base64')
            } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                const cleanedUrl = cleanImageUrl(trimmed)
                const dl = await axios.get(cleanedUrl, {
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    }
                })
                rawBuffer = Buffer.from(dl.data)
            }

            if (!rawBuffer || rawBuffer.length < 500) continue

            let finalBuffer = rawBuffer
            if (sharpMod) {
                finalBuffer = await sharpMod(rawBuffer)
                    .rotate()
                    .flatten({ background: { r: 255, g: 255, b: 255 } })
                    .resize({ width: 1000, height: 1000, fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                    .jpeg({ quality: 94, mozjpeg: true })
                    .toBuffer()
            }

            const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`
            const { error: upErr } = await supabase.storage
                .from('mobile-captures')
                .upload(fileName, finalBuffer, { contentType: 'image/jpeg', upsert: true })

            if (!upErr) {
                const { data: { publicUrl } } = supabase.storage.from('mobile-captures').getPublicUrl(fileName)
                if (publicUrl) uploadedUrls.push(publicUrl)
            }
        } catch (err: any) {
            console.warn('[ClaudeConnector] Image download/upload notice:', err.message)
        }
    }

    return uploadedUrls
}

/**
 * Generates or uploads Studio Product Images and saves them into Supabase Storage ('mobile-captures'),
 * attaching them to the draft and optionally deleting old raw images.
 */
export async function generateStudioImagesAction(input: GenerateStudioImagesInput) {
    assertConnectorCanEdit()
    const scope = getConnectorScope()
    const supabase = await createAdminClient()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let draft: any = null
    const draftId = input.id || input.draft_id

    if (draftId) {
        const { data } = await supabase.from('daraz_draft_listings').select('*').eq('id', draftId).maybeSingle()
        if (data && scope && !isDraftVisible(scope, data)) {
            throw new Error('Permission denied: this draft belongs to a seller account outside your permission scope.')
        }
        draft = data
    } else if (input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(10)
        const visible = scope ? filterVisibleDrafts(scope, data || []) : (data || [])
        draft = visible[0] || null
    }

    const existingImages: string[] = Array.isArray(draft?.images) ? [...draft.images] : []
    const isRawPlaceholderName = (name?: string) => !name || name.startsWith('[Image Only]') || name.startsWith('[Link]') || name.startsWith('Raw Product')
    const rawTitleCandidate = input.product_name || (!isRawPlaceholderName(input.raw_name) ? input.raw_name : '') || draft?.title || (!isRawPlaceholderName(draft?.raw_name) ? draft?.raw_name : '') || 'Product'
    const productName = rawTitleCandidate.split('|')[0].trim() || rawTitleCandidate
    const categoryPath = input.category_path || draft?.category_path || 'E-commerce Product'
    const price = input.price || draft?.special_price || draft?.price || ''
    const slots = Array.isArray(input.slots) && input.slots.length > 0 ? input.slots : [1, 2]

    const generatedUrls: string[] = []

    // 1. Direct Upload Path: If ChatGPT/Claude passed image URLs or base64 strings (e.g. images created/found by ChatGPT)
    const explicitInputs: string[] = [
        ...(Array.isArray(input.images) ? input.images : []),
        ...(Array.isArray(input.image_urls) ? input.image_urls : []),
        ...(Array.isArray(input.images_base64) ? input.images_base64 : []),
        ...(input.base64_image ? [input.base64_image] : []),
        ...(input.source_image_url && !existingImages.includes(input.source_image_url) ? [input.source_image_url] : []),
        ...(input.image_url && !existingImages.includes(input.image_url) ? [input.image_url] : [])
    ].filter(Boolean)

    if (explicitInputs.length > 0) {
        const uploaded = await downloadAndUploadImagesToSupabase(supabase, explicitInputs, 'chatgpt_studio')
        generatedUrls.push(...uploaded)
    }

    // 2. AI Studio Image Generation Path (Gemini Image Generation or OpenAI DALL-E)
    if (generatedUrls.length === 0 && (input.image_prompt || productName)) {
        try {
            const { data: aiRow } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'daraz_ai_settings')
                .maybeSingle()
            const geminiKey = aiRow?.value?.geminiApiKey || aiRow?.value?.apiKey || process.env.GEMINI_API_KEY || ''
            const openaiKey = aiRow?.value?.openaiApiKey || process.env.OPENAI_API_KEY || ''
            const promptText = input.image_prompt || `Professional e-commerce studio product photography of ${productName} (${categoryPath}), centered on a pure solid white background (#FFFFFF), soft studio lighting, sharp focus, 8k commercial product shot.`

            if (geminiKey) {
                for (const modelName of ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image']) {
                    const gemRes = await axios.post(
                        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
                        {
                            contents: [{ parts: [{ text: promptText }] }],
                            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                        },
                        { headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey }, timeout: 25000 }
                    ).catch((e: any) => ({ errorStatus: e.response?.status, data: null }))

                    const parts = gemRes?.data?.candidates?.[0]?.content?.parts || []
                    const imgPart = parts.find((p: any) => p.inlineData?.data)
                    if (imgPart?.inlineData?.data) {
                        const uploaded = await downloadAndUploadImagesToSupabase(
                            supabase,
                            [`data:${imgPart.inlineData.mimeType || 'image/jpeg'};base64,${imgPart.inlineData.data}`],
                            'ai_studio_gemini'
                        )
                        generatedUrls.push(...uploaded)
                        break
                    }
                    if ((gemRes as any)?.errorStatus === 429) break
                }
            }

            if (generatedUrls.length === 0 && openaiKey) {
                const oaRes = await axios.post(
                    'https://api.openai.com/v1/images/generations',
                    {
                        model: 'dall-e-3',
                        prompt: promptText,
                        n: 1,
                        size: '1024x1024',
                        response_format: 'b64_json'
                    },
                    { headers: { Authorization: `Bearer ${openaiKey}` }, timeout: 30000 }
                ).catch(() => null)
                const b64 = oaRes?.data?.data?.[0]?.b64_json
                if (b64) {
                    const uploaded = await downloadAndUploadImagesToSupabase(
                        supabase,
                        [`data:image/png;base64,${b64}`],
                        'ai_studio_dalle'
                    )
                    generatedUrls.push(...uploaded)
                }
            }
        } catch (err: any) {
            console.warn('[ClaudeConnector] Prompt image generation notice:', err.message)
        }
    }

    // 3. Clean E-Commerce Studio Catalog Image Lookup (when Gemini Free Tier hits 429 quota)
    if (generatedUrls.length === 0 && productName && productName !== 'Product') {
        try {
            const stopWords = new Set(['and', 'or', 'for', 'with', 'the', 'in', 'on', 'to', 'of', 'a', 'an', 'by'])
            const searchQuery = String(productName)
                .replace(/[^\w\s-]/g, ' ')
                .split(/\s+/)
                .filter((w: string) => w.length > 1 && !stopWords.has(w.toLowerCase()))
                .slice(0, 4)
                .join(' ')
            const catRes = await axios.get(
                `https://www.daraz.com.np/catalog/?ajax=true&q=${encodeURIComponent(searchQuery)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                    },
                    timeout: 12000
                }
            ).catch(() => null)

            const listItems: any[] = catRes?.data?.mods?.listItems || []
            const candidateUrls: string[] = []
            for (const item of listItems) {
                if (item?.image && typeof item.image === 'string' && item.image.startsWith('http')) {
                    const clean = cleanImageUrl(item.image)
                    if (!candidateUrls.includes(clean)) candidateUrls.push(clean)
                }
                if (candidateUrls.length >= 2) break
            }

            if (candidateUrls.length > 0) {
                const uploaded = await downloadAndUploadImagesToSupabase(supabase, candidateUrls.slice(0, 2), 'daraz_studio_clean')
                generatedUrls.push(...uploaded)
            }
        } catch (catImgErr: any) {
            console.warn('[ClaudeConnector] Studio catalog image lookup notice:', catImgErr.message)
        }
    }

    // 4. Last Resort Fallback: Frame existing source image via /api/daraz/products/ai-image-generate
    const fallbackSourceUrl = input.source_image_url || input.image_url || existingImages[0] || null
    if (generatedUrls.length === 0 && fallbackSourceUrl) {
        try {
            const res = await fetch(`${baseUrl}/api/daraz/products/ai-image-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rawImageUrl: fallbackSourceUrl,
                    productName,
                    categoryPath,
                    price,
                    selectedSlots: slots
                })
            })
            const json = await res.json()
            if (json.success && json.results) {
                Object.values(json.results).forEach((u: any) => {
                    if (typeof u === 'string' && u.startsWith('http')) {
                        generatedUrls.push(u)
                    }
                })
            }
        } catch (err: any) {
            console.warn('[ClaudeConnector] Studio image endpoint notice:', err.message)
        }
    }

    // 5. Update draft images & delete old raw images
    // Default to replacing old raw mobile capture images when new studio images are generated/uploaded unless explicitly false
    const hasOnlyRawCaptures = existingImages.length > 0 && existingImages.every(u =>
        u.includes('mobile_capture_') || u.includes('daraz_prod_white_cover_') || u.includes('daraz_prod_perspective_view_')
    )
    const shouldReplaceOld =
        input.replace_existing_images === true ||
        input.delete_old_images === true ||
        (input.replace_existing_images === undefined && hasOnlyRawCaptures && generatedUrls.length > 0)

    let updatedImages = [...existingImages]
    const removedUrls: string[] = []

    if (shouldReplaceOld) {
        if (generatedUrls.length > 0) {
            removedUrls.push(...existingImages.filter(u => !generatedUrls.includes(u)))
            updatedImages = [...generatedUrls]
        }
    } else {
        if (Array.isArray(input.delete_image_urls) && input.delete_image_urls.length > 0) {
            const toDel = new Set(input.delete_image_urls)
            updatedImages = updatedImages.filter(u => {
                if (toDel.has(u)) {
                    removedUrls.push(u)
                    return false
                }
                return true
            })
        }
        if (Array.isArray(input.delete_image_indices) && input.delete_image_indices.length > 0) {
            const idxSet = new Set(input.delete_image_indices.map(Number))
            updatedImages = updatedImages.filter((u, idx) => {
                if (idxSet.has(idx)) {
                    removedUrls.push(u)
                    return false
                }
                return true
            })
        }
        if (generatedUrls.length > 0) {
            updatedImages = Array.from(new Set([...generatedUrls, ...updatedImages])).slice(0, 8)
        }
    }

    if (removedUrls.length > 0) {
        await removeImagesFromStorageIfOwned(supabase, removedUrls)
    }

    if (draft?.id) {
        const draftUpdates: Record<string, any> = {
            images: updatedImages,
            updated_at: new Date().toISOString()
        }
        if (input.include_image_in_description && updatedImages[0]) {
            draftUpdates.description = formatDescription(draft.description, draft.raw_name, updatedImages[0])
        }
        await supabase.from('daraz_draft_listings').update(draftUpdates).eq('id', draft.id)
    }

    return {
        success: generatedUrls.length > 0 || removedUrls.length > 0,
        draft_id: draft?.id || null,
        generated_images: generatedUrls,
        deleted_old_images: removedUrls,
        current_draft_images: updatedImages,
        message: generatedUrls.length > 0
            ? `Generated ${generatedUrls.length} studio product image(s)${removedUrls.length > 0 ? ` and deleted ${removedUrls.length} old image(s)` : ''}.`
            : removedUrls.length > 0
                ? `Deleted ${removedUrls.length} image(s) from the draft.`
                : 'No new images were generated (ensure the draft has a source image or Gemini Imagen API key is configured).'
    }
}

// ── Category Disambiguation Helper ──────────────────────────────────────────

async function resolveCategoryInput(
    query: string,
    confirmCategory: boolean = false
): Promise<{
    needsConfirmation: boolean
    categoryId: number | null
    categoryPath: string | null
    message?: string
    suggestions?: Array<{ category_id: number; name: string; category_path: string }>
}> {
    const trimmed = query.trim()
    if (!trimmed) {
        return { needsConfirmation: false, categoryId: null, categoryPath: null }
    }

    const results = await searchDarazCategories(trimmed, 6)
    if (results.length === 0) {
        return {
            needsConfirmation: true,
            categoryId: null,
            categoryPath: null,
            message: `No matching Daraz category found for "${trimmed}". Please ask the user for a different category keyword or search using search_daraz_categories.`,
            suggestions: []
        }
    }

    const lower = trimmed.toLowerCase()
    const exactPath = results.find(r => r.path.toLowerCase() === lower)
    if (exactPath) {
        return { needsConfirmation: false, categoryId: exactPath.id, categoryPath: exactPath.path }
    }

    const exactLeafMatches = results.filter(r => r.name.toLowerCase() === lower)
    if (exactLeafMatches.length === 1) {
        return { needsConfirmation: false, categoryId: exactLeafMatches[0].id, categoryPath: exactLeafMatches[0].path }
    }

    const isAmbiguous =
        results.length > 1 &&
        !confirmCategory &&
        (exactLeafMatches.length > 1 || results[1].score >= results[0].score * 0.65)

    if (isAmbiguous) {
        return {
            needsConfirmation: true,
            categoryId: null,
            categoryPath: null,
            message: `Multiple Daraz categories matched "${trimmed}". Show these options to the user and ask which one is correct, then call again with the chosen category_id (or confirm_category: true for the top match).`,
            suggestions: results.map(r => ({
                category_id: r.id,
                name: r.name,
                category_path: r.path
            }))
        }
    }

    return {
        needsConfirmation: false,
        categoryId: results[0].id,
        categoryPath: results[0].path
    }
}

// ── Per-Store Map Resolution Helper ─────────────────────────────────────────

function resolvePerStoreMap<T>(
    rawMap: Record<string, any> | undefined,
    stores: StoreAccountInfo[],
    transform: (val: any) => T
): Record<string, T> {
    const out: Record<string, T> = {}
    if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
        return out
    }
    Object.entries(rawMap).forEach(([storeKey, val]) => {
        if (val === undefined || val === null) return
        const keyTerm = storeKey.toLowerCase()
        const matchedStore = stores.find(s =>
            s.seller_account.toLowerCase().includes(keyTerm) ||
            keyTerm.includes(s.seller_account.toLowerCase()) ||
            s.id === storeKey
        )
        if (matchedStore) {
            out[matchedStore.id] = transform(val)
        }
    })
    return out
}

// ── Save Product Draft ──────────────────────────────────────────────────────

export async function saveProductDraft(input: SaveDraftInput) {
    assertConnectorCanEdit()
    const scope = getConnectorScope()
    if (!input.raw_name || !input.raw_name.trim()) {
        throw new Error('Product name (raw_name) is required')
    }

    // 0. Resolve Supplier (fuzzy match with confirmation if not exact)
    let resolvedSupplierId: string | null = input.supplier_id || null
    let resolvedSupplierName: string | null = null
    if (input.supplier_id || input.supplier_name) {
        const supRes = await resolveSupplierByNameOrId({
            supplier_id: input.supplier_id,
            supplier_name: input.supplier_name,
            confirm_supplier: input.confirm_supplier
        })
        if (supRes.needsConfirmation) {
            return {
                success: false,
                status: 'supplier_confirmation_required',
                provided_supplier_name: input.supplier_name,
                suggested_suppliers: supRes.candidates,
                message: supRes.message
            }
        }
        resolvedSupplierId = supRes.supplierId
        resolvedSupplierName = supRes.supplierName
    }

    // 1. Resolve pricing (input price = special price, price = MRP)
    const pricing = resolvePricing(input.mrp_price || input.price, input.special_price || input.price)
    const finalMrp = input.mrp_price && Number(input.mrp_price) > 0 ? Number(input.mrp_price) : pricing.price

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

    // 4. Clean images & optionally generate studio images before formatting description
    let cleanedImages = (input.images || []).map(cleanImageUrl).filter(Boolean)
    if (input.generate_studio_images || input.image_prompt) {
        try {
            const genRes = await generateStudioImagesAction({
                raw_name: rawName,
                source_image_url: cleanedImages[0],
                image_prompt: input.image_prompt,
                replace_existing_images: input.replace_existing_images
            })
            if (genRes.generated_images && genRes.generated_images.length > 0) {
                cleanedImages = input.replace_existing_images
                    ? genRes.generated_images
                    : [...genRes.generated_images, ...cleanedImages].slice(0, 8)
            }
        } catch (imgErr: any) {
            console.warn('[ClaudeConnector] Studio image generation in saveProductDraft:', imgErr.message)
        }
    }

    const embedImgUrl = input.description_image_url || (input.include_image_in_description ? cleanedImages[0] : null)
    const resolvedDescriptionsPerStore = resolvePerStoreMap(
        input.descriptions_per_store,
        stores,
        (val) => formatDescription(String(val), rawName, embedImgUrl)
    )
    const resolvedHighlightsPerStore = resolvePerStoreMap(
        input.highlights_per_store,
        stores,
        (val) => formatHighlights(val)
    )
    const fallbackDescInput = input.description || Object.values(resolvedDescriptionsPerStore)[0]
    const fallbackHighlightsInput = input.highlights || Object.values(resolvedHighlightsPerStore)[0]
    const description = formatDescription(fallbackDescInput, rawName, embedImgUrl)
    const highlights = formatHighlights(fallbackHighlightsInput)

    if (Object.keys(resolvedDescriptionsPerStore).length > 0) {
        stores.forEach(store => {
            if (!resolvedDescriptionsPerStore[store.id]) {
                resolvedDescriptionsPerStore[store.id] = description
            }
        })
    }
    if (Object.keys(resolvedHighlightsPerStore).length > 0) {
        stores.forEach(store => {
            if (!resolvedHighlightsPerStore[store.id]) {
                resolvedHighlightsPerStore[store.id] = highlights
            }
        })
    }

    // 5. Resolve Variants
    const variantInfo = buildVariantSkuRows(rawName, input.variants, finalMrp, pricing.specialPrice)
    const finalPrice = variantInfo.hasVariants && variantInfo.skuRows[0]?.price ? variantInfo.skuRows[0].price : finalMrp
    const finalSpecialPrice = variantInfo.hasVariants && variantInfo.skuRows[0]?.specialPrice ? variantInfo.skuRows[0].specialPrice : pricing.specialPrice

    // 6. Resolve Category (supports explicit category_id, or category_path/category_name with multi-match disambiguation)
    let categoryId = input.category_id || null
    let categoryPath = input.category_path || input.category_name || input.category || null

    if (categoryId && (!categoryPath || !categoryPath.includes('>'))) {
        const leaves = await getDarazLeafCategories()
        const matched = leaves.find(l => l.id === Number(categoryId))
        if (matched) categoryPath = matched.path
    } else if (!categoryId && categoryPath) {
        const catRes = await resolveCategoryInput(categoryPath, Boolean(input.confirm_category))
        if (catRes.needsConfirmation) {
            return {
                success: false,
                needs_category_confirmation: true,
                message: catRes.message,
                suggested_categories: catRes.suggestions
            }
        }
        categoryId = catRes.categoryId
        categoryPath = catRes.categoryPath
    } else if (!categoryId || (categoryId === 10520 && !rawName.toLowerCase().includes('car'))) {
        try {
            const best = await resolveBestCategory(rawName, categoryPath || undefined)
            if (best) {
                categoryId = best.id
                categoryPath = best.path
            }
        } catch (catErr: any) {
            console.warn('[ClaudeConnector] Category resolve error:', catErr.message)
        }
    }

    // 7. Merge Specifications, Pricing & Variants into Attributes
    const attributesPayload: Record<string, any> = {
        ...(input.attributes || {}),
        ...(scope?.userId ? { created_by: scope.userId } : {})
    }
    if (input.product_link) {
        attributesPayload.product_link = input.product_link
    }
    if (input.campaign_price !== undefined) {
        attributesPayload.campaign_price = Number(input.campaign_price)
    }
    if (input.mrp_price !== undefined) {
        attributesPayload.mrp_price = Number(input.mrp_price)
    }
    if (resolvedSupplierName) {
        attributesPayload.supplier_name = resolvedSupplierName
    }
    if (Object.keys(resolvedDescriptionsPerStore).length > 0) {
        attributesPayload.descriptions_per_store = resolvedDescriptionsPerStore
    }
    if (Object.keys(resolvedHighlightsPerStore).length > 0) {
        attributesPayload.highlights_per_store = resolvedHighlightsPerStore
    }

    const computedDraftType = computeDraftType({
        raw_name: rawName,
        title: primaryTitle,
        images: cleanedImages,
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

    // Calculate profit summary if pricing or wholesale price is present
    let profitSummary: any = null
    if (finalSpecialPrice > 0 || (input.wholesale_price && Number(input.wholesale_price) > 0)) {
        try {
            profitSummary = await calculateDarazProfitAction({
                raw_name: rawName,
                category_id: categoryId || undefined,
                category_path: categoryPath || undefined,
                selling_price: finalSpecialPrice || undefined,
                wholesale_price: input.wholesale_price
            })
        } catch { }
    }

    // 8. De-duplication / Merging with recent draft
    const supabase = await createAdminClient()
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: recentDraftsRaw } = await supabase
        .from('daraz_draft_listings')
        .select('*')
        .ilike('raw_name', rawName)
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(5)

    const recentDrafts = scope ? filterVisibleDrafts(scope, recentDraftsRaw || []) : (recentDraftsRaw || [])

    if (recentDrafts && recentDrafts.length > 0) {
        const existing = recentDrafts[0]
        const mergedStoreIds = Array.from(new Set([...(existing.target_stores || []), ...targetStoreIds]))
        const mergedTitles = { ...(existing.titles_per_store || {}), ...resolvedTitlesPerStore }
        const mergedAttributes = {
            ...(existing.attributes || {}),
            ...attributesPayload,
            ...(Object.keys(resolvedDescriptionsPerStore).length > 0
                ? { descriptions_per_store: { ...(existing.attributes?.descriptions_per_store || {}), ...resolvedDescriptionsPerStore } }
                : {}),
            ...(Object.keys(resolvedHighlightsPerStore).length > 0
                ? { highlights_per_store: { ...(existing.attributes?.highlights_per_store || {}), ...resolvedHighlightsPerStore } }
                : {})
        }
        const mergedImages = cleanedImages.length > 0
            ? (input.replace_existing_images ? cleanedImages : Array.from(new Set([...cleanedImages, ...(existing.images || [])])))
            : (existing.images || [])
        const mergedType = computeDraftType({
            raw_name: rawName,
            title: primaryTitle || existing.title,
            images: mergedImages,
            category_id: categoryId || existing.category_id,
            description: description || existing.description,
            highlights: highlights.length > 0 ? highlights : existing.highlights,
            product_link: mergedAttributes.product_link,
            status: existing.status
        })
        mergedAttributes.draft_type = mergedType

        const updatePayload: Record<string, any> = {
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
            images: mergedImages,
            supplier_id: resolvedSupplierId || existing.supplier_id,
            wholesale_price: input.wholesale_price !== undefined ? input.wholesale_price : existing.wholesale_price,
            status: mergedType === 'ready' ? 'generated' : (existing.status || 'draft'),
            updated_at: new Date().toISOString()
        }

        const { data: updated, error: updateErr } = await supabase
            .from('daraz_draft_listings')
            .update(updatePayload)
            .eq('id', existing.id)
            .select('*')
            .single()

        if (!updateErr && updated) {
            await syncPricingAndSupplierToInventoryTables({
                productName: rawName,
                supplierId: updated.supplier_id,
                wholesalePrice: updated.wholesale_price,
                sellingPrice: updated.special_price,
                campaignPrice: input.campaign_price,
                mrpPrice: updated.price,
                imageUrl: mergedImages[0] || null
            })

            const allStores = await listDarazStores()
            const storeNames = mergedStoreIds.map(id => allStores.find(s => s.id === id)?.seller_account || id).join(', ')

            return {
                success: true,
                message: `Single draft updated for "${rawName}" across store(s): [${storeNames}]!`,
                profit_summary: profitSummary,
                draft: {
                    id: updated.id,
                    raw_name: updated.raw_name,
                    daraz_title: updated.title,
                    price: updated.price,
                    special_price: updated.special_price,
                    wholesale_price: updated.wholesale_price,
                    campaign_price: updated.attributes?.campaign_price || null,
                    supplier_id: updated.supplier_id,
                    supplier_name: resolvedSupplierName || updated.attributes?.supplier_name || null,
                    category: updated.category_path,
                    has_variants: !!updated.attributes?.has_variants,
                    variants_count: updated.attributes?.sku_rows?.length || 0,
                    images_count: (updated.images || []).length,
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
            images: cleanedImages,
            target_stores: targetStoreIds,
            price: finalPrice || null,
            special_price: finalSpecialPrice || null,
            supplier_id: resolvedSupplierId || null,
            wholesale_price: input.wholesale_price || null,
            status: computedDraftType === 'ready' ? 'generated' : 'draft'
        })
        .select('*')
        .single()

    if (error) throw new Error(error.message)

    // Sync supplier & pricing to inventory database tables
    await syncPricingAndSupplierToInventoryTables({
        productName: rawName,
        supplierId: resolvedSupplierId,
        wholesalePrice: input.wholesale_price,
        sellingPrice: finalSpecialPrice,
        campaignPrice: input.campaign_price,
        mrpPrice: finalPrice,
        imageUrl: cleanedImages[0] || null
    })

    const storeNames = stores.map(s => s.seller_account).join(', ')

    return {
        success: true,
        message: `Draft created successfully for "${rawName}" across store(s): [${storeNames}]!`,
        profit_summary: profitSummary,
        draft: {
            id: data.id,
            raw_name: data.raw_name,
            daraz_title: data.title,
            price: data.price,
            special_price: data.special_price,
            wholesale_price: data.wholesale_price,
            campaign_price: data.attributes?.campaign_price || null,
            supplier_id: data.supplier_id,
            supplier_name: resolvedSupplierName || null,
            category: data.category_path,
            has_variants: !!data.attributes?.has_variants,
            variants_count: data.attributes?.sku_rows?.length || 0,
            images_count: (data.images || []).length,
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
    assertConnectorCanEdit()
    const scope = getConnectorScope()
    const supabase = await createAdminClient()

    let draftId = input.id || input.draft_id
    let existingDraft: any = null

    if (draftId) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', draftId)
            .single()
        if (data && scope && !isDraftVisible(scope, data)) {
            throw new Error('Permission denied: this draft belongs to a seller account outside your permission scope.')
        }
        existingDraft = data
    } else if (input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(10)
        const visible = scope ? filterVisibleDrafts(scope, data || []) : (data || [])
        if (visible.length > 0) {
            existingDraft = visible[0]
            draftId = existingDraft.id
        }
    }

    if (!existingDraft || !draftId) {
        throw new Error(`Draft not found for: ${input.id || input.draft_id || input.raw_name || 'unknown'}`)
    }

    // Resolve supplier if supplier_name or supplier_id is passed
    let resolvedSupplierId: string | undefined = input.supplier_id
    let resolvedSupplierName: string | null = null
    if (input.supplier_id || input.supplier_name) {
        const supRes = await resolveSupplierByNameOrId({
            supplier_id: input.supplier_id,
            supplier_name: input.supplier_name,
            confirm_supplier: input.confirm_supplier
        })
        if (supRes.needsConfirmation) {
            return {
                success: false,
                status: 'supplier_confirmation_required',
                draft_id: draftId,
                provided_supplier_name: input.supplier_name,
                suggested_suppliers: supRes.candidates,
                message: supRes.message
            }
        }
        resolvedSupplierId = supRes.supplierId || undefined
        resolvedSupplierName = supRes.supplierName
    }

    const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
    }

    if (input.raw_name) updates.raw_name = input.raw_name.trim()
    if (input.title) updates.title = input.title.trim()
    if (input.titles_per_store) updates.titles_per_store = input.titles_per_store
    if (input.highlights) updates.highlights = formatHighlights(input.highlights)

    // Category add / edit with auto-lookup & multi-match disambiguation
    const requestedCategoryQuery = (input.category_path || input.category_name || input.category || '').trim()
    if (input.category_id !== undefined && input.category_id !== null) {
        updates.category_id = Number(input.category_id)
        if (requestedCategoryQuery && requestedCategoryQuery.includes('>')) {
            updates.category_path = requestedCategoryQuery
        } else {
            const leaves = await getDarazLeafCategories()
            const matched = leaves.find(l => l.id === Number(input.category_id))
            if (matched) {
                updates.category_path = matched.path
            } else if (requestedCategoryQuery) {
                updates.category_path = requestedCategoryQuery
            }
        }
    } else if (requestedCategoryQuery) {
        const catRes = await resolveCategoryInput(requestedCategoryQuery, Boolean(input.confirm_category))
        if (catRes.needsConfirmation) {
            return {
                success: false,
                needs_category_confirmation: true,
                message: catRes.message,
                suggested_categories: catRes.suggestions
            }
        }
        updates.category_id = catRes.categoryId
        updates.category_path = catRes.categoryPath
    }

    if (input.wholesale_price !== undefined) updates.wholesale_price = input.wholesale_price
    if (resolvedSupplierId !== undefined) updates.supplier_id = resolvedSupplierId
    if (input.status) updates.status = input.status

    // Handle studio image generation, direct image upload, and/or old image deletion
    let currentImages: string[] = Array.isArray(existingDraft.images) ? [...existingDraft.images] : []
    if (input.images !== undefined && Array.isArray(input.images) && input.images.length > 0) {
        const uploadedToBucket = await downloadAndUploadImagesToSupabase(supabase, input.images, 'chatgpt_upload')
        const incomingCleaned = uploadedToBucket.length > 0 ? uploadedToBucket : input.images.map(cleanImageUrl).filter(Boolean)
        const hasOnlyRawCaptures = currentImages.length > 0 && currentImages.every(u =>
            u.includes('mobile_capture_') || u.includes('daraz_prod_white_cover_') || u.includes('daraz_prod_perspective_view_')
        )
        if (input.replace_existing_images || input.delete_old_images || hasOnlyRawCaptures) {
            await removeImagesFromStorageIfOwned(supabase, currentImages.filter(u => !incomingCleaned.includes(u)))
            currentImages = incomingCleaned
        } else {
            currentImages = incomingCleaned
        }
        updates.images = currentImages
    }

    if (
        input.generate_studio_images ||
        input.image_prompt ||
        (Array.isArray(input.delete_image_indices) && input.delete_image_indices.length > 0) ||
        (Array.isArray(input.delete_image_urls) && input.delete_image_urls.length > 0) ||
        (input.delete_old_images && input.images === undefined)
    ) {
        const imgAct = await generateStudioImagesAction({
            draft_id: draftId,
            raw_name: updates.raw_name || existingDraft.raw_name,
            source_image_url: currentImages[0],
            image_prompt: input.image_prompt,
            replace_existing_images: input.replace_existing_images,
            delete_old_images: input.delete_old_images,
            delete_image_indices: input.delete_image_indices,
            delete_image_urls: input.delete_image_urls,
            include_image_in_description: input.include_image_in_description
        })
        currentImages = imgAct.current_draft_images
        updates.images = currentImages
    }

    const embedImgUrl = input.description_image_url || (input.include_image_in_description ? currentImages[0] : null)
    if (input.description !== undefined || embedImgUrl) {
        updates.description = formatDescription(
            input.description !== undefined ? input.description : existingDraft.description,
            updates.raw_name || existingDraft.raw_name,
            embedImgUrl
        )
    }

    if (input.price !== undefined || input.special_price !== undefined || input.mrp_price !== undefined) {
        const p = resolvePricing(
            input.mrp_price || input.price || existingDraft.price,
            input.special_price || input.price || existingDraft.special_price
        )
        updates.price = input.mrp_price && Number(input.mrp_price) > 0 ? Number(input.mrp_price) : p.price
        updates.special_price = p.specialPrice
    }

    if (input.store_accounts || input.store_account_name) {
        const stores = await resolveTargetStores({
            store_account_name: input.store_account_name,
            store_accounts: input.store_accounts
        })
        updates.target_stores = scope
            ? mergeTargetStoresForScope(scope, existingDraft.target_stores, stores.map(s => s.id))
            : stores.map(s => s.id)
    }

    let existingAttributes = { ...(existingDraft.attributes || {}) }
    if (input.descriptions_per_store || input.highlights_per_store) {
        const allStores = await listDarazStores()
        if (input.descriptions_per_store) {
            const mappedDescs = resolvePerStoreMap(
                input.descriptions_per_store,
                allStores,
                (val) => formatDescription(String(val), updates.raw_name || existingDraft.raw_name, embedImgUrl)
            )
            existingAttributes.descriptions_per_store = {
                ...(existingAttributes.descriptions_per_store || {}),
                ...mappedDescs
            }
            if (!updates.description && Object.values(mappedDescs)[0]) {
                updates.description = Object.values(mappedDescs)[0]
            }
        }
        if (input.highlights_per_store) {
            const mappedHighlights = resolvePerStoreMap(
                input.highlights_per_store,
                allStores,
                (val) => formatHighlights(val)
            )
            existingAttributes.highlights_per_store = {
                ...(existingAttributes.highlights_per_store || {}),
                ...mappedHighlights
            }
            if (!updates.highlights && Object.values(mappedHighlights)[0]) {
                updates.highlights = Object.values(mappedHighlights)[0]
            }
        }
    }
    if (input.product_link !== undefined) {
        existingAttributes.product_link = input.product_link
    }
    if (input.campaign_price !== undefined) {
        existingAttributes.campaign_price = Number(input.campaign_price)
    }
    if (input.mrp_price !== undefined) {
        existingAttributes.mrp_price = Number(input.mrp_price)
    }
    if (resolvedSupplierName) {
        existingAttributes.supplier_name = resolvedSupplierName
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

    // Sync supplier & pricing to inventory database tables
    await syncPricingAndSupplierToInventoryTables({
        productName: updated.raw_name,
        supplierId: updated.supplier_id,
        wholesalePrice: updated.wholesale_price,
        sellingPrice: updated.special_price,
        campaignPrice: updated.attributes?.campaign_price,
        mrpPrice: updated.price,
        imageUrl: (updated.images || [])[0] || null
    })

    let profitSummary: any = null
    if (updated.special_price > 0 || updated.wholesale_price > 0) {
        try {
            profitSummary = await calculateDarazProfitAction({
                draft_id: updated.id,
                selling_price: updated.special_price,
                wholesale_price: updated.wholesale_price
            })
        } catch { }
    }

    return {
        success: true,
        message: `Draft "${updated.raw_name}" updated successfully!`,
        profit_summary: profitSummary,
        draft: {
            id: updated.id,
            raw_name: updated.raw_name,
            daraz_title: updated.title,
            price: updated.price,
            special_price: updated.special_price,
            wholesale_price: updated.wholesale_price,
            campaign_price: updated.attributes?.campaign_price || null,
            supplier_id: updated.supplier_id,
            supplier_name: updated.attributes?.supplier_name || null,
            category: updated.category_path,
            has_variants: !!updated.attributes?.has_variants,
            variants_count: updated.attributes?.sku_rows?.length || 0,
            images_count: (updated.images || []).length,
            images: updated.images || [],
            product_link: updated.attributes?.product_link || null,
            draft_type: updatedDraftType,
            status: updated.status,
            updated_at: updated.updated_at
        }
    }
}

// ── Delete Product Draft ────────────────────────────────────────────────────

export async function deleteProductDraft(input: DeleteDraftInput) {
    assertConnectorCanEdit()
    const scope = getConnectorScope()
    const supabase = await createAdminClient()

    let draftId = input.id || input.draft_id
    let draftName = input.raw_name

    if (draftId) {
        const { data: existing } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', draftId)
            .maybeSingle()
        if (!existing || (scope && !isDraftVisible(scope, existing))) {
            throw new Error(`Permission denied or draft not found: ${draftId}`)
        }
        draftName = existing.raw_name || draftName
    } else if (input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(10)
        const visible = scope ? filterVisibleDrafts(scope, data || []) : (data || [])
        if (visible.length > 0) {
            draftId = visible[0].id
            draftName = visible[0].raw_name
        }
    }

    if (!draftId) {
        throw new Error(`Draft not found to delete: ${input.id || input.draft_id || input.raw_name || 'unknown'}`)
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

// ── Shared Helper: Multi-Model Vision Inspection with DB Caching ─────────────

async function inspectDraftImageWithVision(
    supabase: any,
    draft: any | null,
    firstImg: OptimizedImage | null
): Promise<Record<string, any> | null> {
    if (draft?.attributes?.visual_analysis && draft.attributes.visual_analysis.identified_product_name) {
        return draft.attributes.visual_analysis
    }
    if (!firstImg) return null

    try {
        const { data: aiRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_ai_settings')
            .maybeSingle()

        const { data: imgAiRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_image_ai_settings')
            .maybeSingle()

        const aiCfg = aiRow?.value || {}
        const imgCfg = imgAiRow?.value || {}
        const geminiKey =
            aiCfg.geminiApiKey ||
            (String(aiCfg.model || '').startsWith('gemini') ? aiCfg.apiKey : '') ||
            imgCfg.apiKey ||
            process.env.GEMINI_API_KEY ||
            ''
        const openaiKey =
            aiCfg.openaiApiKey ||
            (!String(aiCfg.model || '').startsWith('gemini') ? aiCfg.apiKey : '') ||
            process.env.OPENAI_API_KEY ||
            ''

        const visionPrompt = `Carefully inspect this product photo for a Daraz Nepal e-commerce listing. Read any visible brand name, label text, model number, item count, color, material, and shape. Return ONLY a valid JSON object with:
{
  "identified_product_name": "clear specific product name (3-8 words, including brand/type if visible)",
  "brand_or_label_text": "exact text or brand visible on the product/packaging, or 'No Brand'",
  "suggested_seo_title": "Daraz SEO title (60-100 chars with key attributes, material & use case)",
  "visible_details": "detailed visual description of shape, color, material, packaging text, and components",
  "suggested_category_keywords": "2-4 Daraz category search keywords",
  "suggested_highlights": [
    "• Highlight 1 covering material and build quality",
    "• Highlight 2 covering key design feature",
    "• Highlight 3 covering primary use case",
    "• Highlight 4 covering convenience/portability",
    "• Highlight 5 covering package contents"
  ],
  "suggested_description_summary": "Detailed 2-paragraph product description based on the photo"
}`

        let visualAnalysis: Record<string, any> | null = null

        if (geminiKey) {
            const candidateModels = Array.from(new Set([
                'gemini-3.8-flash',
                'gemini-3.7-flash',
                'gemini-3.6-flash',
                'gemini-3.5-flash-lite',
                'gemini-3.5-flash',
                'gemini-flash-lite-latest',
                'gemini-flash-latest',
                ...(aiCfg.model && String(aiCfg.model).startsWith('gemini') ? [String(aiCfg.model)] : [])
            ]))

            for (const modelName of candidateModels) {
                const gemRes = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
                    {
                        contents: [{
                            parts: [
                                { text: visionPrompt },
                                { inlineData: { mimeType: firstImg.mimeType, data: firstImg.base64 } }
                            ]
                        }],
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
                    },
                    { headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey }, timeout: 18000 }
                ).catch(() => null)

                const txt = gemRes?.data?.candidates?.[0]?.content?.parts?.[0]?.text
                if (txt) {
                    try {
                        visualAnalysis = JSON.parse(txt.replace(/```json|```/g, '').trim())
                        if (visualAnalysis?.identified_product_name) break
                    } catch { }
                }
            }
        }

        if (!visualAnalysis && openaiKey) {
            const oaRes = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    response_format: { type: 'json_object' },
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'text', text: visionPrompt },
                            { type: 'image_url', image_url: { url: firstImg.dataUrl } }
                        ]
                    }]
                },
                { headers: { Authorization: `Bearer ${openaiKey}` }, timeout: 18000 }
            ).catch(() => null)
            const txt = oaRes?.data?.choices?.[0]?.message?.content
            if (txt) {
                try {
                    visualAnalysis = JSON.parse(txt)
                } catch { }
            }
        }

        // Cache visual_analysis inside draft.attributes so future lookups are instant
        if (visualAnalysis && draft?.id) {
            const nextAttrs = {
                ...(draft.attributes || {}),
                visual_analysis: visualAnalysis
            }
            draft.attributes = nextAttrs
            await supabase
                .from('daraz_draft_listings')
                .update({ attributes: nextAttrs })
                .eq('id', draft.id)
                .then(() => { })
                .catch(() => { })
        }

        return visualAnalysis
    } catch (visErr: any) {
        console.warn('[ClaudeConnector] Vision inspection fallback notice:', visErr.message)
        return null
    }
}

// ── Get Draft Details ───────────────────────────────────────────────────────

export async function getDraftDetails(input: GetDraftDetailsInput) {
    const scope = getConnectorScope()
    const supabase = await createAdminClient()

    const draftId = input.id || input.draft_id
    let query = supabase.from('daraz_draft_listings').select('*')

    if (draftId) {
        query = query.eq('id', draftId)
    } else if (input.raw_name) {
        query = query.ilike('raw_name', `%${input.raw_name.trim()}%`).order('created_at', { ascending: false }).limit(10)
    } else {
        throw new Error('Please provide draft "id" or "raw_name"')
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const rows = Array.isArray(data) ? data : (data ? [data] : [])
    const visibleRows = scope ? filterVisibleDrafts(scope, rows) : rows
    const draft = visibleRows[0]
    if (!draft) throw new Error(`No draft found matching ${draftId || input.raw_name} in your permitted seller account(s).`)

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

    // Automatically run AI vision inspection when inspecting an image_only draft or a draft without title/description
    let visualAnalysis = draft.attributes?.visual_analysis || null
    if (!visualAnalysis && optimizedImages.length > 0 && (draftType === 'image_only' || !draft.title || !draft.description)) {
        visualAnalysis = await inspectDraftImageWithVision(supabase, draft, optimizedImages[0])
    }

    const directImages: string[] = Array.isArray(draft.images) ? draft.images : []
    const primaryImageUrl = directImages[0] || null

    return {
        success: true,
        _images: optimizedImages,
        visual_analysis: visualAnalysis,
        draft: {
            id: draft.id,
            raw_name: draft.raw_name,
            identified_product_From_image: visualAnalysis?.identified_product_name || null,
            visual_analysis: visualAnalysis,
            title: draft.title,
            titles_per_store: draft.titles_per_store,
            descriptions_per_store: draft.attributes?.descriptions_per_store || {},
            highlights_per_store: draft.attributes?.highlights_per_store || {},
            price: draft.price,
            special_price: draft.special_price,
            campaign_price: draft.attributes?.campaign_price || null,
            category_id: draft.category_id,
            category_path: draft.category_path,
            attributes: draft.attributes,
            variants: draft.attributes?.sku_rows || [],
            has_variants: !!draft.attributes?.has_variants,
            assigned_stores: storeNames,
            description: draft.description,
            highlights: draft.highlights,
            images: directImages,
            original_images: directImages,
            primary_image_url: primaryImageUrl,
            images_loaded_for_vision: optimizedImages.length,
            wholesale_price: draft.wholesale_price,
            supplier_id: draft.supplier_id,
            supplier_name: draft.attributes?.supplier_name || null,
            product_link: prodLink,
            draft_type: draftType,
            status: draft.status,
            created_at: draft.created_at,
            updated_at: draft.updated_at
        }
    }
}

// ── View Draft Images (Dedicated Vision Tool for Claude MCP + ChatGPT Actions) ─

export async function viewDraftImages(input: ViewDraftImagesInput) {
    const scope = getConnectorScope()
    const supabase = await createAdminClient()
    let draft: any = null
    let targetImages: string[] = []
    const lookupId = input.id || input.draft_id

    if (input.image_url) {
        targetImages = [input.image_url]
    } else if (lookupId) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', lookupId)
            .single()
        if (data && scope && !isDraftVisible(scope, data)) {
            throw new Error('Permission denied: this draft belongs to a seller account outside your permission scope.')
        }
        draft = data
    } else if (input.raw_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', `%${input.raw_name.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(10)
        const visible = scope ? filterVisibleDrafts(scope, data || []) : (data || [])
        draft = visible[0]
    } else {
        // Fallback: pick most recent image_only draft if user says "check my image-only draft" without passing ID
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25)
        const visible = scope ? filterVisibleDrafts(scope, data || []) : (data || [])
        draft = visible.find(d => Array.isArray(d.images) && d.images.length > 0 && (d.raw_name?.startsWith('[Image Only]') || d.attributes?.draft_type === 'image_only')) || visible[0]
    }

    if (draft && Array.isArray(draft.images)) {
        targetImages = draft.images.filter((img: any) => typeof img === 'string' && img.startsWith('http'))
    }

    if (targetImages.length === 0) {
        throw new Error(`No product images found for draft: ${lookupId || input.raw_name || 'unknown'}`)
    }

    const limit = Math.min(Math.max(input.max_images || 2, 1), 4)
    const toProcess = targetImages.slice(0, limit)
    const processed = (await Promise.all(toProcess.map(url => fetchAndOptimizeImage(url)))).filter(Boolean) as OptimizedImage[]

    if (processed.length === 0) {
        throw new Error('Failed to load image bytes from the specified URL(s)')
    }

    // Run multi-model backend AI Vision inspection (cached in draft.attributes.visual_analysis)
    const visualAnalysis = await inspectDraftImageWithVision(supabase, draft, processed[0] || null)
    const primaryImageUrl = targetImages[0] || null

    return {
        success: true,
        draft_id: draft?.id || null,
        draft_name: draft?.raw_name || null,
        identified_product_name: visualAnalysis?.identified_product_name || null,
        draft_type: draft?.attributes?.draft_type || null,
        primary_image_url: primaryImageUrl,
        original_image_urls: targetImages,
        images_count: processed.length,
        visual_analysis: visualAnalysis,
        _images: processed,
        images: processed.map((p) => ({
            url: p.url,
            original_url: p.url,
            mimeType: p.mimeType,
            width: p.width,
            height: p.height,
            size_kb: Math.round(p.sizeBytes / 1024),
            data_url: p.dataUrl
        })),
        message: visualAnalysis
            ? `Successfully inspected product image(s) for draft "${draft?.raw_name || draft?.id}". Identified Product: "${visualAnalysis.identified_product_name}". Full visual details and direct public Supabase image URLs are included.`
            : `Successfully loaded ${processed.length} product image(s). Image blocks are attached for vision, and direct public Supabase image URLs are provided.`
    }
}

// ── Bulk Add Products ───────────────────────────────────────────────────────

export async function bulkAddProducts(input: BulkAddInput) {
    assertConnectorCanEdit()
    const scope = getConnectorScope()
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
            const attributesPayload: Record<string, any> = {
                ...(scope?.userId ? { created_by: scope.userId } : {})
            }
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
    const scope = getConnectorScope()
    const supabase = await createAdminClient()
    let query = supabase
        .from('daraz_draft_listings')
        .select('id, raw_name, title, titles_per_store, price, special_price, wholesale_price, supplier_id, category_id, category_path, status, target_stores, images, attributes, description, highlights, created_at')
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

    const visibleRows = scope ? filterVisibleDrafts(scope, data || []) : (data || [])

    // Auto-analyze up to 2 image_only drafts that do not yet have cached visual_analysis
    // so ChatGPT/Claude/Gemini immediately know what product is in the image even from get_draft_listings!
    let autoInspectedCount = 0
    for (const d of visibleRows) {
        const isImgOnly = (d.raw_name?.startsWith('[Image Only]') || d.attributes?.draft_type === 'image_only') && Array.isArray(d.images) && d.images.length > 0
        if (isImgOnly && !d.attributes?.visual_analysis && autoInspectedCount < 2) {
            autoInspectedCount++
            const firstUrl = d.images.find((u: any) => typeof u === 'string' && u.startsWith('http'))
            if (firstUrl) {
                const opt = await fetchAndOptimizeImage(firstUrl).catch(() => null)
                if (opt) {
                    await inspectDraftImageWithVision(supabase, d, opt)
                }
            }
        }
    }

    const mapped = visibleRows.map(d => {
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

        const directImages: string[] = Array.isArray(d.images) ? d.images : []
        const primaryImageUrl = directImages[0] || null
        const visualAnalysis = d.attributes?.visual_analysis || null

        return {
            id: d.id,
            raw_name: d.raw_name,
            identified_product_name: visualAnalysis?.identified_product_name || null,
            visual_analysis: visualAnalysis,
            title: d.title,
            titles_per_store: d.titles_per_store,
            price: d.price,
            special_price: d.special_price,
            wholesale_price: d.wholesale_price,
            campaign_price: d.attributes?.campaign_price || null,
            supplier_id: d.supplier_id,
            supplier_name: d.attributes?.supplier_name || null,
            category_id: d.category_id,
            category_path: d.category_path,
            status: d.status,
            target_stores: d.target_stores,
            images: directImages,
            original_images: directImages,
            primary_image_url: primaryImageUrl,
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
    assertConnectorCanEdit()
    const scope = getConnectorScope()
    const supabase = await createAdminClient()

    // 0. Load existing draft if id/draft_id or product_name matches
    const lookupId = input.id || input.draft_id
    let existingDraft: any = null

    if (lookupId) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', lookupId)
            .maybeSingle()
        if (data && scope && !isDraftVisible(scope, data)) {
            throw new Error('Permission denied: this draft belongs to a seller account outside your permission scope.')
        }
        existingDraft = data
    } else if (input.product_name) {
        const { data } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .ilike('raw_name', input.product_name.trim())
            .order('created_at', { ascending: false })
            .limit(10)
        const visible = scope ? filterVisibleDrafts(scope, data || []) : (data || [])
        existingDraft = visible[0] || null
    }

    const productName = (input.product_name || existingDraft?.raw_name || '').trim()
    if (!productName) {
        throw new Error('Please provide product_name or draft id to push to Daraz.')
    }

    // Resolve supplier if provided
    let resolvedSupplierId: string | null = input.supplier_id || existingDraft?.supplier_id || null
    if (input.supplier_id || input.supplier_name) {
        const supRes = await resolveSupplierByNameOrId({
            supplier_id: input.supplier_id,
            supplier_name: input.supplier_name,
            confirm_supplier: input.confirm_supplier
        })
        if (supRes.needsConfirmation) {
            return {
                success: false,
                status: 'supplier_confirmation_required',
                provided_supplier_name: input.supplier_name,
                suggested_suppliers: supRes.candidates,
                message: supRes.message
            }
        }
        resolvedSupplierId = supRes.supplierId
    }

    // Resolve target stores (from input or existing draft's target_stores)
    let stores = await resolveTargetStores({
        store_account_name: input.store_account_name,
        store_accounts: input.store_accounts
    })
    if (!input.store_account_name && (!input.store_accounts || input.store_accounts.length === 0) && existingDraft?.target_stores?.length > 0) {
        const allStores = await listDarazStores()
        const draftStores = allStores.filter(s => existingDraft.target_stores.includes(s.id))
        if (draftStores.length > 0) {
            stores = draftStores
        }
    }
    if (stores.length === 0) {
        throw new Error('No active Daraz store found. Please connect a Daraz seller account first.')
    }

    const targetStoreIds = stores.map(s => s.id)
    const storeNamesLabel = stores.map(s => s.seller_account).join(', ')

    // 1. Resolve pricing & variants
    const rawPrice = input.mrp_price ?? input.price ?? existingDraft?.price
    const rawSpecialPrice = input.special_price ?? input.price ?? existingDraft?.special_price
    const pricing = resolvePricing(rawPrice, rawSpecialPrice)

    const variantInfo = buildVariantSkuRows(
        productName,
        input.variants || existingDraft?.attributes?.sku_rows,
        pricing.price,
        pricing.specialPrice
    )

    const title = input.title || existingDraft?.title || `${productName} - Premium Quality`
    const titlesPerStore: Record<string, string> = { ...(existingDraft?.titles_per_store || {}) }
    if (input.titles_per_store && typeof input.titles_per_store === 'object') {
        Object.entries(input.titles_per_store).forEach(([storeKey, titleVal]) => {
            const keyTerm = storeKey.toLowerCase()
            const matched = stores.find(s =>
                s.seller_account.toLowerCase().includes(keyTerm) ||
                keyTerm.includes(s.seller_account.toLowerCase()) ||
                s.id === storeKey
            )
            if (matched && titleVal) {
                titlesPerStore[matched.id] = titleVal
            }
        })
    }
    stores.forEach(s => {
        if (!titlesPerStore[s.id]) {
            titlesPerStore[s.id] = title
        }
    })

    // 2. Resolve Images: Clean URLs and fallback to existing draft if images were previously saved
    let resolvedImages = (input.images || []).map(cleanImageUrl).filter(Boolean)
    if (resolvedImages.length === 0 && existingDraft?.images && Array.isArray(existingDraft.images)) {
        resolvedImages = existingDraft.images.map(cleanImageUrl).filter(Boolean)
    }

    const embedImgUrl = input.description_image_url || (input.include_image_in_description ? resolvedImages[0] : null)
    const description = formatDescription(input.description || existingDraft?.description, productName, embedImgUrl)
    const highlights = formatHighlights(
        input.highlights && (Array.isArray(input.highlights) ? input.highlights.length > 0 : input.highlights.trim().length > 0)
            ? input.highlights
            : existingDraft?.highlights
    )

    const mergedAttributes: Record<string, any> = {
        ...(existingDraft?.attributes || {}),
        ...(input.attributes || {})
    }
    if (input.campaign_price !== undefined) mergedAttributes.campaign_price = Number(input.campaign_price)
    if (input.mrp_price !== undefined) mergedAttributes.mrp_price = Number(input.mrp_price)
    if (variantInfo.hasVariants) {
        mergedAttributes.has_variants = true
        mergedAttributes.variant1_name = variantInfo.variant1Name
        mergedAttributes.variant1_values = variantInfo.variant1Values
        mergedAttributes.sku_rows = variantInfo.skuRows
    }

    const hasImages = resolvedImages.length > 0
    if (!hasImages) {
        const draftPayload = {
            raw_name: productName,
            title,
            titles_per_store: titlesPerStore,
            price: pricing.price,
            special_price: pricing.specialPrice,
            wholesale_price: input.wholesale_price ?? existingDraft?.wholesale_price ?? null,
            supplier_id: resolvedSupplierId,
            target_stores: targetStoreIds,
            category_id: input.category_id || existingDraft?.category_id || null,
            category_path: input.category_path || existingDraft?.category_path || null,
            attributes: mergedAttributes,
            description,
            highlights,
            status: 'generated',
            updated_at: new Date().toISOString()
        }

        const { data: savedDraft, error: draftErr } = existingDraft?.id
            ? await supabase.from('daraz_draft_listings').update(draftPayload).eq('id', existingDraft.id).select('id, raw_name, title, status').single()
            : await supabase.from('daraz_draft_listings').insert(draftPayload).select('id, raw_name, title, status').single()

        if (draftErr) throw new Error(draftErr.message)

        return {
            success: true,
            status: 'draft_ready_for_images',
            stores: storeNamesLabel,
            draft_id: savedDraft.id,
            message: `Product "${productName}" saved as "${savedDraft.title}" for store(s) [${storeNamesLabel}]. Note: Daraz requires at least 1 product image before publishing to the live marketplace. Upload an image or use generate_studio_images first.`
        }
    }

    // 3. Resolve Category
    let categoryId = input.category_id || existingDraft?.category_id
    let categoryPath = input.category_path || input.category_name || input.category || existingDraft?.category_path

    if (!categoryId || (categoryId === 10520 && !productName.toLowerCase().includes('car'))) {
        try {
            const best = await resolveBestCategory(productName, categoryPath)
            if (best) {
                categoryId = best.id
                categoryPath = best.path
            }
        } catch (catErr: any) {
            console.warn('[ClaudeConnector] Category resolve error in push:', catErr.message)
        }
    }

    // 4. Construct SKUs for Daraz API (route.ts will automatically generate unique Seller SKUs per store!)
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

    // 5. Push to Daraz API across ALL target stores
    const existingDraftId: string | null = existingDraft?.id || null
    const finalWholesale = input.wholesale_price ?? existingDraft?.wholesale_price ?? null
    const finalCampaign = input.campaign_price ?? mergedAttributes.campaign_price ?? null

    try {
        const createRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/daraz/products/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...signInternalUser(scope?.userId || '__master__')
            },
            body: JSON.stringify({
                storeIds: targetStoreIds,
                primaryCategory: categoryId,
                name: title,
                rawName: productName,
                titlesPerStore,
                descriptionsPerStore: {
                    ...(mergedAttributes.descriptions_per_store || {}),
                    ...(input.descriptions_per_store ? resolvePerStoreMap(input.descriptions_per_store, stores, (v) => formatDescription(String(v), productName)) : {})
                },
                highlightsPerStore: {
                    ...(mergedAttributes.highlights_per_store || {}),
                    ...(input.highlights_per_store ? resolvePerStoreMap(input.highlights_per_store, stores, (v) => formatHighlights(v)) : {})
                },
                shortDescription: highlights.join('\n'),
                description,
                brand: input.brand || mergedAttributes.brand || 'No Brand',
                attributes: mergedAttributes,
                skus: finalSkus,
                images: resolvedImages,
                supplier_id: resolvedSupplierId,
                wholesale_price: finalWholesale,
                sales_price: pricing.specialPrice,
                campaign_price: finalCampaign,
                mrp_price: pricing.price
            })
        })

        const result = await createRes.json()

        // Check if all store pushes failed
        const successfulList = (result.results || []).filter((r: any) => r.success)
        const isFailed = !createRes.ok || !result.success || successfulList.length === 0
        const firstError = result.results?.find((r: any) => !r.success)?.error || result.error || 'Failed to push to Daraz'

        if (isFailed) {
            const failPayload = {
                raw_name: productName,
                title,
                titles_per_store: titlesPerStore,
                price: pricing.price,
                special_price: pricing.specialPrice,
                wholesale_price: finalWholesale,
                supplier_id: resolvedSupplierId,
                target_stores: targetStoreIds,
                category_id: categoryId,
                category_path: categoryPath,
                attributes: mergedAttributes,
                images: resolvedImages,
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
                stores: storeNamesLabel,
                error: firstError,
                details: result.results || [],
                message: `Failed to push "${title}" to Daraz [${storeNamesLabel}]: ${firstError}. Marked as failed in drafts.`
            }
        }

        const successPayload = {
            raw_name: productName,
            title,
            titles_per_store: titlesPerStore,
            price: pricing.price,
            special_price: pricing.specialPrice,
            wholesale_price: finalWholesale,
            supplier_id: resolvedSupplierId,
            target_stores: targetStoreIds,
            category_id: categoryId,
            category_path: categoryPath,
            attributes: mergedAttributes,
            images: resolvedImages,
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

        const skuSummary = (result.results || [])
            .filter((r: any) => r.success)
            .map((r: any) => `${r.sellerAccount}: [${(r.pushedSellerSkus || []).join(', ')}]`)
            .join(' | ')

        return {
            success: true,
            status: 'pushed',
            stores: storeNamesLabel,
            store_skus: skuSummary,
            message: `Successfully pushed "${title}" (Special Rs. ${pricing.specialPrice}, MRP Rs. ${pricing.price}) to ${successfulList.length}/${stores.length} Daraz store(s) [${storeNamesLabel}] with unique Seller SKUs (${skuSummary})!`,
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
            } catch { }
        }
        return {
            success: false,
            stores: storeNamesLabel,
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
