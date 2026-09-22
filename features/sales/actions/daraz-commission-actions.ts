'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

import type { OtherFeeItem, DarazCommissionItem } from '@/features/sales/utils/daraz-fee-calculator'
import { DEFAULT_OTHER_FEES } from '@/features/sales/utils/daraz-fee-calculator'


/**
 * Get paginated list of Daraz category commissions with search & filters
 */
export async function getDarazCategoryCommissions(params: {
    page?: number
    limit?: number
    search?: string
    category1?: string
    sortBy?: 'category_1' | 'leaf_category' | 'commission_rate' | 'updated_at'
    sortOrder?: 'asc' | 'desc'
}) {
    const {
        page = 1,
        limit = 50,
        search = '',
        category1 = '',
        sortBy = 'category_path',
        sortOrder = 'asc'
    } = params

    const supabase = await createAdminClient()

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('daraz_category_commissions')
        .select('*', { count: 'exact' })

    if (search && search.trim()) {
        const q = search.trim()
        query = query.or(`category_path.ilike.%${q}%,leaf_category.ilike.%${q}%,category_1.ilike.%${q}%,category_2.ilike.%${q}%,category_3.ilike.%${q}%`)
    }

    if (category1 && category1.trim()) {
        query = query.eq('category_1', category1.trim())
    }

    if (sortBy === 'category_1') {
        query = query.order('category_1', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'leaf_category') {
        query = query.order('leaf_category', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'commission_rate') {
        query = query.order('commission_rate', { ascending: sortOrder === 'asc' })
    } else {
        query = query.order('category_path', { ascending: sortOrder === 'asc' })
    }

    const { data, count, error } = await query.range(from, to)

    if (error) {
        throw new Error(`Failed to fetch category commissions: ${error.message}`)
    }

    return {
        items: (data || []) as DarazCommissionItem[],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

/**
 * Get unique list of Category 1 names for filtering
 */
export async function getUniqueCategory1List(): Promise<string[]> {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_category_commissions')
        .select('category_1')
        .order('category_1', { ascending: true })

    if (error || !data) return []

    const set = new Set<string>()
    data.forEach(r => {
        if (r.category_1 && r.category_1.trim()) {
            set.add(r.category_1.trim())
        }
    })
    return Array.from(set).sort()
}

/**
 * Bulk upload a batch of category commissions from parsed sheet
 */
export async function bulkUploadDarazCommissions(rows: any[]): Promise<{
    success: boolean
    upserted: number
    error?: string
}> {
    if (!rows || rows.length === 0) {
        return { success: true, upserted: 0 }
    }

    const supabase = await createAdminClient()

    const mapByPath = new Map<string, any>()

    for (const raw of rows) {
        // Extract category 1 to 6
        const c1 = String(raw['Category 1'] || raw['category_1'] || raw['Category1'] || raw['Cat 1'] || '').trim()
        const c2 = String(raw['Category 2'] || raw['category_2'] || raw['Category2'] || raw['Cat 2'] || '').trim()
        const c3 = String(raw['Category 3'] || raw['category_3'] || raw['Category3'] || raw['Cat 3'] || '').trim()
        const c4 = String(raw['Category 4'] || raw['category_4'] || raw['Category4'] || raw['Cat 4'] || '').trim()
        const c5 = String(raw['Category 5'] || raw['category_5'] || raw['Category5'] || raw['Cat 5'] || '').trim()
        const c6 = String(raw['Category 6'] || raw['category_6'] || raw['Category6'] || raw['Cat 6'] || '').trim()

        if (!c1) continue // Category 1 is required

        // Determine leaf category (deepest non-empty level)
        const levels = [c1, c2, c3, c4, c5, c6].filter(Boolean)
        const leaf = levels[levels.length - 1]
        const path = levels.join(' > ')

        // Parse commission rate
        let rateRaw = raw['Commission Rate (%)'] ?? raw['Commission Rate'] ?? raw['commission_rate'] ?? raw['Commission %'] ?? raw['Rate'] ?? 0
        if (typeof rateRaw === 'string') {
            rateRaw = rateRaw.replace(/%/g, '').trim()
        }
        let rate = parseFloat(rateRaw)
        if (isNaN(rate)) rate = 0

        mapByPath.set(path, {
            category_1: c1,
            category_2: c2 || null,
            category_3: c3 || null,
            category_4: c4 || null,
            category_5: c5 || null,
            category_6: c6 || null,
            leaf_category: leaf,
            category_path: path,
            commission_rate: parseFloat(rate.toFixed(2)),
            updated_at: new Date().toISOString()
        })
    }

    const preparedRows = Array.from(mapByPath.values())

    if (preparedRows.length === 0) {
        return { success: true, upserted: 0 }
    }

    // Upsert on category_path
    const { error } = await supabase
        .from('daraz_category_commissions')
        .upsert(preparedRows, {
            onConflict: 'category_path',
            ignoreDuplicates: false
        })

    if (error) {
        console.error('bulkUploadDarazCommissions error:', error)
        throw new Error(`Failed to upload batch: ${error.message}`)
    }

    return {
        success: true,
        upserted: preparedRows.length
    }
}

/**
 * Save a single category commission manually (Insert or Update)
 */
export async function saveDarazCategoryCommission(item: {
    id?: string
    category_1: string
    category_2?: string | null
    category_3?: string | null
    category_4?: string | null
    category_5?: string | null
    category_6?: string | null
    commission_rate: number
}) {
    const supabase = await createAdminClient()

    const c1 = item.category_1.trim()
    const c2 = item.category_2?.trim() || null
    const c3 = item.category_3?.trim() || null
    const c4 = item.category_4?.trim() || null
    const c5 = item.category_5?.trim() || null
    const c6 = item.category_6?.trim() || null

    const levels = [c1, c2, c3, c4, c5, c6].filter(Boolean) as string[]
    const leaf = levels[levels.length - 1]
    const path = levels.join(' > ')

    const payload: any = {
        category_1: c1,
        category_2: c2,
        category_3: c3,
        category_4: c4,
        category_5: c5,
        category_6: c6,
        leaf_category: leaf,
        category_path: path,
        commission_rate: parseFloat(item.commission_rate.toFixed(2)),
        updated_at: new Date().toISOString()
    }

    if (item.id) {
        const { error } = await supabase
            .from('daraz_category_commissions')
            .update(payload)
            .eq('id', item.id)

        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from('daraz_category_commissions')
            .upsert(payload, { onConflict: 'category_path' })

        if (error) throw new Error(error.message)
    }

    revalidatePath('/dashboard/settings/daraz-commission')
    return { success: true }
}

/**
 * Delete a category commission row
 */
export async function deleteDarazCategoryCommission(id: string) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_category_commissions')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/settings/daraz-commission')
    return { success: true }
}

/**
 * Clear all category commissions
 */
export async function clearAllDarazCategoryCommissions() {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_category_commissions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/settings/daraz-commission')
    return { success: true }
}

/**
 * Get Other Fee deduction rules
 */
export async function getDarazOtherFees(): Promise<OtherFeeItem[]> {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_other_fees')
        .maybeSingle()

    if (error || !data?.value || !Array.isArray(data.value) || data.value.length === 0) {
        return DEFAULT_OTHER_FEES
    }

    const rawList = data.value as OtherFeeItem[]
    // Ensure all items have apply_vat defined and handling fee is tiered bracket
    return rawList.map(item => {
        if (item.id === 'handling_fee' && item.type !== 'bracket') {
            return {
                ...item,
                type: 'bracket' as const,
                rate: 0,
                apply_vat: true,
                description: 'Daraz tiered item handling fee + 13% VAT (0-400: Rs.5.65, 401-1000: Rs.11.30, 1001-1500: Rs.16.95, 1500+: Rs.33.90)'
            }
        }
        return {
            ...item,
            apply_vat: item.apply_vat !== undefined
                ? Boolean(item.apply_vat)
                : (item.id === 'payment_fee' || item.id === 'free_shipping_max' || item.name?.toLowerCase().includes('payment') || item.name?.toLowerCase().includes('shipping'))
        }
    })
}

/**
 * Save Other Fee deduction rules
 */
export async function saveDarazOtherFees(fees: OtherFeeItem[]): Promise<{ success: boolean }> {
    const supabase = await createAdminClient()

    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key: 'daraz_other_fees',
            value: fees,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' })

    if (error) throw new Error(`Failed to save other fees: ${error.message}`)

    revalidatePath('/dashboard/settings/daraz-commission')
    return { success: true }
}


