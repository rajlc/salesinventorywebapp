import { createAdminClient } from '@/lib/supabase/server'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import axios from 'axios'

// ── Types ───────────────────────────────────────────────────────────────────

export interface StoreAccountInfo {
    id: string
    seller_account: string
    seller_id: string
    is_active: boolean
}

export interface SaveDraftInput {
    raw_name: string
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
    images?: string[]
    supplier_id?: string
    wholesale_price?: number
}

export interface BulkAddProductItem {
    name: string
    title?: string
    description?: string
    highlights?: string[]
    price?: number
    special_price?: number
    wholesale_price?: number
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
    price: number
    special_price?: number
    store_account_name?: string
    store_accounts?: string[]
    category_id?: number
    category_path?: string
    images?: string[]
    description?: string
    highlights?: string[]
    brand?: string
}

export interface GetDraftsInput {
    status?: 'draft' | 'generating' | 'generated' | 'pushing' | 'pushed' | 'failed' | 'all'
    limit?: number
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
        // Split by comma, 'and', '&'
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

// ── Save Product Draft ──────────────────────────────────────────────────────

export async function saveProductDraft(input: SaveDraftInput) {
    if (!input.raw_name || !input.raw_name.trim()) {
        throw new Error('Product name (raw_name) is required')
    }

    // 1. Resolve target stores (support multiple stores, e.g. "Balaju Shop and Bagmati")
    const stores = await resolveTargetStores({
        store_account_name: input.store_account_name,
        store_accounts: input.store_accounts
    })
    const targetStoreIds = stores.map(s => s.id)

    // 2. Resolve Titles per store & Primary Title
    const resolvedTitlesPerStore: Record<string, string> = {}

    // If Claude passed titles_per_store mapping by store name
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

    // Determine the base title:
    // Either passed explicitly as input.title, or if Claude made raw_name a long title, extract it
    let baseTitle = input.title
    let rawName = input.raw_name.trim()

    // If no explicit title was passed, but raw_name looks like a full SEO title (>40 chars or has hyphens):
    if (!baseTitle && (rawName.length > 40 || rawName.includes(' - ') || rawName.includes(' | '))) {
        baseTitle = rawName
        // Extract a shorter raw name (first segment before - or |)
        const shortName = rawName.split(/[-|—]/)[0].trim()
        if (shortName.length >= 3) {
            rawName = shortName
        }
    } else if (!baseTitle) {
        // Generate a clean SEO title if none provided
        baseTitle = `${rawName} - Premium Quality & Durable`
    }

    // Ensure every targeted store has a title
    stores.forEach(store => {
        if (!resolvedTitlesPerStore[store.id]) {
            resolvedTitlesPerStore[store.id] = baseTitle!
        }
    })

    const primaryTitle = baseTitle || Object.values(resolvedTitlesPerStore)[0] || rawName

    // 3. Resolve Description
    let description = (input.description || '').trim()
    if (!description) {
        description = `<p><strong>Perfect for:</strong></p><ul><li>Everyday home and personal use</li><li>Reliable daily performance and convenience</li><li>Quick fixes, alterations and projects</li></ul><p>Compact, durable, and high-quality ${rawName}. Designed for user convenience, portability, and long-lasting durability.</p>`
    } else if (!description.includes('<p>') && !description.includes('<div>') && !description.includes('<ul>')) {
        // Claude sent plain text -> format as proper HTML paragraphs for Daraz rich text editor
        description = description
            .split(/\r?\n\r?\n/)
            .map(para => `<p>${para.trim().replace(/\r?\n/g, '<br/>')}</p>`)
            .join('')
    }

    // 4. Resolve Highlights
    let highlights: string[] = []
    if (Array.isArray(input.highlights)) {
        highlights = input.highlights
            .map(h => String(h).replace(/^[\s*•\-\d.)]+/, '').trim())
            .filter(Boolean)
    } else if (typeof input.highlights === 'string' && (input.highlights as string).trim()) {
        highlights = (input.highlights as string)
            .split(/\r?\n/)
            .map(line => line.replace(/^[\s*•\-\d.)]+/, '').trim())
            .filter(Boolean)
    }

    if (highlights.length === 0) {
        highlights = [
            `Premium quality ${rawName}`,
            'Compact, lightweight and portable design',
            'Easy to operate and beginner-friendly',
            'Durable construction for reliable daily use',
            'Excellent value for home and travel'
        ]
    }

    // 5. Resolve Category Suggestion if missing
    let categoryId = input.category_id || null
    let categoryPath = input.category_path || null

    if (!categoryId && targetStoreIds.length > 0) {
        try {
            const token = await getValidAccessToken(targetStoreIds[0])
            if (token) {
                const params = buildSignedParams('/product/category/suggestion/get', token, {
                    product_name: rawName
                })
                const res = await axios.get(`${API_URL}/product/category/suggestion/get`, { params })
                const suggestions = res.data?.data?.categorySuggestions || []
                if (suggestions.length > 0) {
                    categoryId = Number(suggestions[0].categoryId)
                    categoryPath = suggestions[0].categoryPath
                }
            }
        } catch (err: any) {
            console.error('[ClaudeConnector] Category suggestion error:', err.message)
        }
    }

    // 6. Check for recent draft with same raw_name (within 5 minutes) to merge stores and avoid duplicates!
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

        const { data: updated, error: updateErr } = await supabase
            .from('daraz_draft_listings')
            .update({
                target_stores: mergedStoreIds,
                titles_per_store: mergedTitles,
                title: primaryTitle || existing.title,
                description: input.description || existing.description || description,
                highlights: (input.highlights && input.highlights.length > 0) ? input.highlights : (existing.highlights || highlights),
                price: input.price || existing.price,
                special_price: input.special_price || existing.special_price,
                category_id: categoryId || existing.category_id,
                category_path: categoryPath || existing.category_path,
                status: 'draft',
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select('id, raw_name, title, titles_per_store, price, status, target_stores, description, highlights, created_at')
            .single()

        if (!updateErr && updated) {
            const allStores = await listDarazStores()
            const storeNames = mergedStoreIds.map(id => allStores.find(s => s.id === id)?.seller_account || id).join(', ')

            return {
                success: true,
                message: `Single draft saved for "${rawName}" across store(s): [${storeNames}]!`,
                draft: {
                    id: updated.id,
                    raw_name: updated.raw_name,
                    daraz_title: updated.title,
                    titles_per_store: updated.titles_per_store,
                    price: updated.price,
                    status: 'draft',
                    assigned_stores: storeNames,
                    highlights_count: (updated.highlights || []).length,
                    has_description: !!updated.description,
                    created_at: updated.created_at
                }
            }
        }
    }

    // 7. Save new draft into Supabase with status 'draft'
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
            images: input.images || [],
            target_stores: targetStoreIds,
            price: input.price || null,
            special_price: input.special_price || null,
            supplier_id: input.supplier_id || null,
            wholesale_price: input.wholesale_price || null,
            status: 'draft'
        })
        .select('id, raw_name, title, titles_per_store, price, status, target_stores, description, highlights, created_at')
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
            titles_per_store: resolvedTitlesPerStore,
            price: data.price,
            status: 'draft',
            assigned_stores: storeNames,
            highlights_count: (data.highlights || []).length,
            has_description: !!data.description,
            created_at: data.created_at
        }
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
            const title = p.title || `${raw} - High Quality`
            const titlesPerStore: Record<string, string> = {}
            targetStoreIds.forEach(id => { titlesPerStore[id] = title })

            return {
                raw_name: raw,
                title,
                titles_per_store: titlesPerStore,
                description: p.description || `<p>High quality ${raw}. Durable and reliable.</p>`,
                highlights: p.highlights || [`Premium ${raw}`, 'High durability', 'Best value guaranteed'],
                price: p.price || null,
                special_price: p.special_price || null,
                wholesale_price: p.wholesale_price || null,
                images: p.images || [],
                target_stores: targetStoreIds,
                status: 'generated'
            }
        })

    if (validItems.length === 0) {
        throw new Error('No valid products found with names')
    }

    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_draft_listings')
        .insert(validItems)
        .select('id, raw_name, title, price, status')

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
        .select('id, raw_name, title, titles_per_store, price, status, target_stores, images, created_at')
        .order('created_at', { ascending: false })
        .limit(input.limit || 20)

    if (input.status && input.status !== 'all') {
        query = query.eq('status', input.status)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return {
        success: true,
        total: (data || []).length,
        drafts: data || []
    }
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

    // 1. Check images: Daraz requires at least 1 image to create a live listing
    const hasImages = input.images && input.images.length > 0
    if (!hasImages) {
        const title = input.title || `${input.product_name} - Premium Quality`
        const titlesPerStore: Record<string, string> = { [store.id]: title }

        // Save as a prepared draft so seller can attach image in webapp
        const { data: draft, error: draftErr } = await supabase
            .from('daraz_draft_listings')
            .insert({
                raw_name: input.product_name,
                title,
                titles_per_store: titlesPerStore,
                price: input.price,
                special_price: input.special_price || null,
                target_stores: [store.id],
                description: input.description || `<p>${input.product_name}</p>`,
                highlights: input.highlights || [input.product_name],
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

    // 2. Resolve Category if not provided
    let categoryId = input.category_id
    if (!categoryId) {
        try {
            const token = await getValidAccessToken(store.id)
            if (token) {
                const params = buildSignedParams('/product/category/suggestion/get', token, {
                    product_name: input.product_name
                })
                const res = await axios.get(`${API_URL}/product/category/suggestion/get`, { params })
                const suggestions = res.data?.data?.categorySuggestions || []
                if (suggestions.length > 0) {
                    categoryId = Number(suggestions[0].categoryId)
                }
            }
        } catch (err: any) {
            console.error('[ClaudeConnector] Category suggestion error:', err.message)
        }
    }

    if (!categoryId) {
        categoryId = 10000001 // Default general category if Daraz auto-detect fails
    }

    // 3. Build description and highlights
    const description = input.description || `<p>High quality ${input.product_name}</p>`
    const highlights = input.highlights && input.highlights.length > 0
        ? input.highlights
        : [`Genuine ${input.product_name}`, 'High quality material', 'Best value guaranteed']

    const title = input.title || `${input.product_name} - Premium Quality`
    const titlesPerStore: Record<string, string> = { [store.id]: title }

    // 4. Call internal product create endpoint logic
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
                shortDescription: highlights.map(h => `• ${h}`).join('\n'),
                description,
                brand: input.brand || 'No Brand',
                attributes: {},
                skus: [{
                    price: input.price,
                    specialPrice: input.special_price,
                    quantity: 100,
                    packageWeight: 0.1,
                    packageLength: 1,
                    packageWidth: 1,
                    packageHeight: 1,
                    images: input.images
                }],
                images: input.images
            })
        })

        const result = await createRes.json()

        if (!createRes.ok || !result.success) {
            await supabase.from('daraz_draft_listings').insert({
                raw_name: input.product_name,
                title,
                titles_per_store: titlesPerStore,
                price: input.price,
                special_price: input.special_price || null,
                target_stores: [store.id],
                images: input.images || [],
                description,
                highlights,
                status: 'failed',
                error: result.error || 'Push to Daraz failed'
            })

            return {
                success: false,
                store: store.seller_account,
                error: result.error || 'Failed to push to Daraz',
                message: `Failed to push "${title}" to Daraz: ${result.error}. Saved in drafts for review.`
            }
        }

        await supabase.from('daraz_draft_listings').insert({
            raw_name: input.product_name,
            title,
            titles_per_store: titlesPerStore,
            price: input.price,
            special_price: input.special_price || null,
            target_stores: [store.id],
            images: input.images || [],
            description,
            highlights,
            status: 'pushed'
        })

        return {
            success: true,
            status: 'pushed',
            store: store.seller_account,
            message: `Successfully pushed "${title}" (Rs. ${input.price}) to Daraz seller account "${store.seller_account}"!`,
            details: result
        }

    } catch (err: any) {
        return {
            success: false,
            store: store.seller_account,
            error: err.message,
            message: `Error pushing to Daraz: ${err.message}`
        }
    }
}
