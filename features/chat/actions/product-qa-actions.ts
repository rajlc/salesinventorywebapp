'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { extractDarazItemId } from '../constants'

export interface ProductQA {
    id: string
    store_id?: string | null
    product_id?: string | null
    daraz_item_id: string
    seller_sku?: string | null
    question: string
    answer: string
    created_at?: string
    updated_at?: string
}

export interface CatalogProduct {
    id: string
    product_name: string
    product_title?: string | null
    seller_sku1?: string | null
    seller_sku2?: string | null
    daraz_item_id?: string | null
    daraz_product_url?: string | null
    image_url?: string | null
    regular_price?: number | null
    special_price?: number | null
    description?: string | null
    highlights?: string | null
    sales_priority?: boolean | null
    qa_count?: number
}

// 1. Fetch Product Q&As by item_id, product_id, or search
export async function getProductQAs(params: {
    darazItemId?: string | null
    productId?: string | null
    storeId?: string | null
    search?: string
}) {
    try {
        const supabase = await createAdminClient()
        let query = supabase.from('product_qa').select('*').order('created_at', { ascending: false })

        if (params.darazItemId && params.productId) {
            query = query.or(`daraz_item_id.eq.${String(params.darazItemId)},product_id.eq.${params.productId}`)
        } else if (params.darazItemId) {
            query = query.eq('daraz_item_id', String(params.darazItemId))
        } else if (params.productId) {
            query = query.eq('product_id', params.productId)
        }
        if (params.storeId) {
            query = query.eq('store_id', params.storeId)
        }
        if (params.search && params.search.trim()) {
            query = query.or(`question.ilike.%${params.search.trim()}%,answer.ilike.%${params.search.trim()}%`)
        }

        const { data, error } = await query

        if (error) {
            if (error.code === '42P01') {
                console.warn('[ProductQA] Table product_qa does not exist yet.')
                return []
            }
            throw error
        }

        return (data || []) as ProductQA[]
    } catch (err: any) {
        console.error('[ProductQA] Error fetching Q&As:', err.message)
        return []
    }
}

// 2. Add new Product Q&A
export async function addProductQA(payload: {
    store_id?: string | null
    product_id?: string | null
    daraz_item_id?: string | null
    seller_sku?: string | null
    question: string
    answer: string
}) {
    try {
        const supabase = await createAdminClient()

        if (!payload.daraz_item_id && !payload.product_id) {
            return { success: false, error: 'Product or Daraz Item ID is required' }
        }
        if (!payload.question?.trim() || !payload.answer?.trim()) {
            return { success: false, error: 'Both Question and Answer are required' }
        }

        const resolvedItemId = String(payload.daraz_item_id || payload.product_id || '')

        const insertData = {
            store_id: payload.store_id || null,
            product_id: payload.product_id || null,
            daraz_item_id: resolvedItemId,
            seller_sku: payload.seller_sku || null,
            question: payload.question.trim(),
            answer: payload.answer.trim(),
            updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
            .from('product_qa')
            .insert(insertData)
            .select()
            .single()

        if (error) throw error

        try {
            revalidatePath('/dashboard/chat-ai')
            revalidatePath('/dashboard/chat-ai/products')
        } catch {}

        return { success: true, data: data as ProductQA }
    } catch (err: any) {
        console.error('[ProductQA] Error adding Q&A:', err.message)
        return { success: false, error: err.message }
    }
}

// 3. Update existing Product Q&A
export async function updateProductQA(
    id: string,
    payload: {
        question?: string
        answer?: string
        seller_sku?: string | null
    }
) {
    try {
        const supabase = await createAdminClient()

        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        }
        if (payload.question !== undefined) updates.question = payload.question.trim()
        if (payload.answer !== undefined) updates.answer = payload.answer.trim()
        if (payload.seller_sku !== undefined) updates.seller_sku = payload.seller_sku

        const { data, error } = await supabase
            .from('product_qa')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        try {
            revalidatePath('/dashboard/chat-ai')
            revalidatePath('/dashboard/chat-ai/products')
        } catch {}

        return { success: true, data: data as ProductQA }
    } catch (err: any) {
        console.error('[ProductQA] Error updating Q&A:', err.message)
        return { success: false, error: err.message }
    }
}

// 4. Delete Product Q&A
export async function deleteProductQA(id: string) {
    try {
        const supabase = await createAdminClient()

        const { error } = await supabase
            .from('product_qa')
            .delete()
            .eq('id', id)

        if (error) throw error

        try {
            revalidatePath('/dashboard/chat-ai')
            revalidatePath('/dashboard/chat-ai/products')
        } catch {}

        return { success: true }
    } catch (err: any) {
        console.error('[ProductQA] Error deleting Q&A:', err.message)
        return { success: false, error: err.message }
    }
}

// 5. Fetch Products with QA Counts for the Product Knowledge Hub
export async function getProductsForQAHub(params: {
    search?: string
    filter?: 'all' | 'high_selling' | 'with_qa' | 'no_qa'
    page?: number
    limit?: number
}) {
    try {
        const supabase = await createAdminClient()
        const page = params.page || 1
        const limit = params.limit || 100
        const from = (page - 1) * limit
        const to = from + limit - 1

        let query = supabase
            .from('products')
            .select('id, product_name, product_title, seller_sku1, seller_sku2, daraz_product_url, image_url, regular_price, special_price, description, highlights, sales_priority', { count: 'exact' })
            .eq('is_deleted', false)

        if (params.filter === 'high_selling') {
            query = query.eq('sales_priority', true)
        }

        if (params.search && params.search.trim()) {
            const s = params.search.trim()
            query = query.or(`product_name.ilike.%${s}%,product_title.ilike.%${s}%,seller_sku1.ilike.%${s}%,daraz_product_url.ilike.%${s}%`)
        }

        // Put sales_priority items first, then alphabetical
        query = query
            .order('sales_priority', { ascending: false, nullsFirst: false })
            .order('product_name', { ascending: true })
            .range(from, to)

        const { data: rawProducts, count, error } = await query

        if (error) throw error

        const products = (rawProducts || []).map(p => {
            const extractedId = extractDarazItemId(p.daraz_product_url, p.seller_sku1)
            return {
                ...p,
                daraz_item_id: extractedId || p.id
            }
        })

        // Fetch all Q&As count grouped by daraz_item_id / product_id
        const itemIds = products.map(p => p.daraz_item_id).filter(Boolean) as string[]
        const prodIds = products.map(p => p.id)

        const qaCountMap: Record<string, number> = {}

        if (itemIds.length > 0 || prodIds.length > 0) {
            const { data: qaRows, error: qaErr } = await supabase
                .from('product_qa')
                .select('id, daraz_item_id, product_id')

            if (!qaErr && qaRows) {
                for (const row of qaRows) {
                    if (row.daraz_item_id) {
                        qaCountMap[row.daraz_item_id] = (qaCountMap[row.daraz_item_id] || 0) + 1
                    }
                    if (row.product_id) {
                        qaCountMap[row.product_id] = (qaCountMap[row.product_id] || 0) + 1
                    }
                }
            }
        }

        let enriched: CatalogProduct[] = products.map(p => {
            const countByItem = p.daraz_item_id ? (qaCountMap[p.daraz_item_id] || 0) : 0
            const countByProd = qaCountMap[p.id] || 0
            const qaCount = Math.max(countByItem, countByProd)

            return {
                ...p,
                qa_count: qaCount
            }
        })

        // Apply with_qa / no_qa filters if specified
        if (params.filter === 'with_qa') {
            enriched = enriched.filter(p => (p.qa_count || 0) > 0)
        } else if (params.filter === 'no_qa') {
            enriched = enriched.filter(p => (p.qa_count || 0) === 0)
        }

        return {
            success: true,
            products: enriched,
            totalCount: count || enriched.length
        }
    } catch (err: any) {
        console.error('[ProductQA] Error fetching products for QA hub:', err.message)
        return {
            success: false,
            products: [],
            totalCount: 0,
            error: err.message
        }
    }
}
