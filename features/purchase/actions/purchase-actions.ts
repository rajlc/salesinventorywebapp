'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { completePlanForProduct } from './plan-actions'

// ============================================================================
// TYPES
// ============================================================================

export interface Purchase {
    id: string
    purchase_date: string
    product_id: string
    product?: {
        product_name: string
    }
    quantity: number
    unit_amount: number
    total_amount: number
    supplier_id: string
    supplier?: {
        supplier_name: string
    }
    payment_type: 'Cash' | 'Due' | 'Online' | 'Others'
    purchase_type?: string
    purchase_name?: string
    remarks?: string
    created_at: string
    created_by?: string
}

export interface CreatePurchaseData {
    purchase_date?: string
    product_id: string
    quantity: number
    unit_amount: number
    total_amount: number
    supplier_id: string
    payment_type: string
    purchase_type?: string
    purchase_name?: string
    remarks?: string
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get purchases with optional filtering
 */
export async function getPurchases(params: {
    page?: number
    limit?: number
    search?: string
    startDate?: string
    endDate?: string
    fiscalYearId?: string  // Filter by specific fiscal year
    supplierId?: string    // Filter by supplier
    showAll?: boolean      // Bypass fiscal year filtering
}) {
    const { page = 1, limit = 50, search, startDate, endDate, fiscalYearId, supplierId, showAll = false } = params
    const supabase = await createClient()

    const from = (page - 1) * limit
    const to = from + limit - 1

    // If search term is provided, use RPC function for better performance
    if (search && search.trim()) {
        const { data, error } = await supabase.rpc('search_purchases', {
            search_term: search.trim(),
            supplier_filter: supplierId || null,
            start_date_filter: startDate || null,
            end_date_filter: endDate || null,
            fiscal_year_filter: fiscalYearId || null,
            show_all_flag: showAll,
            page_number: page,
            page_limit: limit
        })

        if (error) throw error

        const totalCount = data && data.length > 0 ? data[0].total_count : 0

        return {
            purchases: (data || []).map((item: any) => ({
                ...item,
                product: { product_name: item.product_name },
                supplier: { supplier_name: item.supplier_name }
            })),
            totalCount: Number(totalCount),
            totalPages: Math.ceil(Number(totalCount) / limit),
            currentPage: page
        }
    }

    // Otherwise use standard query
    let query = supabase
        .from('purchases')
        .select(`
            *,
            product:products(product_name),
            supplier:suppliers(supplier_name),
            created_user:user_profiles!purchases_created_by_fkey(full_name)
        `, { count: 'exact' })

    // Fiscal year filtering (unless showAll is true)
    if (!showAll && !startDate && !endDate) {
        if (fiscalYearId) {
            // Filter by specific fiscal year
            const { data: fiscalYear } = await supabase
                .from('fiscal_years')
                .select('start_date, end_date')
                .eq('id', fiscalYearId)
                .single()

            if (fiscalYear) {
                query = query
                    .gte('purchase_date', fiscalYear.start_date)
                    .lte('purchase_date', fiscalYear.end_date)
            }
        } else {
            // Filter by active fiscal year by default
            const { data: activeFY } = await supabase
                .from('fiscal_years')
                .select('start_date, end_date')
                .eq('is_active', true)
                .single()

            if (activeFY) {
                query = query
                    .gte('purchase_date', activeFY.start_date)
                    .lte('purchase_date', activeFY.end_date)
            }
        }
    }

    // Date filters (override fiscal year if provided)
    if (startDate) {
        query = query.gte('purchase_date', startDate)
    }
    if (endDate) {
        query = query.lte('purchase_date', endDate)
    }

    // Supplier filter
    if (supplierId && supplierId.trim()) {
        query = query.eq('supplier_id', supplierId.trim())
    }

    // Search filter - currently searches only in remarks
    // Note: To search in product.product_name or supplier.supplier_name, 
    // we would need to create a PostgreSQL function (RPC) or filter client-side
    if (search && search.trim()) {
        query = query.ilike('remarks', `%${search.trim()}%`)
    }

    query = query
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

    const { data, count, error } = await query

    if (error) throw error

    return {
        purchases: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

/**
 * Get today's purchases
 */
export async function getTodayPurchases() {
    const today = new Date().toISOString().split('T')[0]
    return getPurchases({ startDate: today, endDate: today, limit: 100 })
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create new purchase
 */
export async function createPurchase(data: CreatePurchaseData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: purchase, error } = await supabase
        .from('purchases')
        .insert({
            purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
            product_id: data.product_id,
            quantity: data.quantity,
            unit_amount: data.unit_amount,
            total_amount: data.total_amount,
            supplier_id: data.supplier_id,
            payment_type: data.payment_type,
            purchase_type: data.purchase_type,
            purchase_name: data.purchase_name,
            remarks: data.remarks,
            created_by: user.id,
            updated_by: user.id
        })
        .select()
        .single()

    if (error) throw error

    // Auto-complete any pending plans for this product
    await completePlanForProduct(data.product_id)

    // Log the purchase creation activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')

        // Get supplier name if available
        let supplierName = undefined
        if (data.supplier_id) {
            const { data: supplier } = await supabase
                .from('suppliers')
                .select('supplier_name')
                .eq('id', data.supplier_id)
                .single()
            supplierName = supplier?.supplier_name
        }

        await logActivity('purchase_created', {
            supplier_name: supplierName,
            amount: data.total_amount
        })
    } catch (logError) {
        console.error('Failed to log purchase creation:', logError)
    }

    revalidatePath('/dashboard/purchase/purchase-entry')
    revalidatePath('/dashboard/purchase/daily-purchase-list')

    return purchase
}

/**
 * Update existing purchase
 */
export async function updatePurchase(id: string, data: CreatePurchaseData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: purchase, error } = await supabase
        .from('purchases')
        .update({
            purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
            product_id: data.product_id,
            quantity: data.quantity,
            unit_amount: data.unit_amount,
            total_amount: data.total_amount,
            supplier_id: data.supplier_id,
            payment_type: data.payment_type,
            purchase_type: data.purchase_type,
            purchase_name: data.purchase_name,
            remarks: data.remarks,
            updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    revalidatePath('/dashboard/purchase/purchase-entry')
    revalidatePath('/dashboard/purchase/daily-purchase-list')

    return purchase
}
