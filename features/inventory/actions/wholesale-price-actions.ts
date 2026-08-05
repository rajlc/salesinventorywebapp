'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Save a new wholesale price record
 */
export async function saveWholesalePrice(data: {
    product_id: string
    supplier_id: string
    wholesale_price: number
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: record, error } = await supabase
        .from('product_wholesale_prices')
        .insert({
            product_id: data.product_id,
            supplier_id: data.supplier_id,
            wholesale_price: data.wholesale_price,
            created_by: user.id
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving wholesale price:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/wholesale-price')
    return record
}

/**
 * Get all saved wholesale prices for a specific product
 */
export async function getWholesalePricesByProductId(productId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('product_wholesale_prices')
        .select(`
            *,
            supplier:suppliers(supplier_name)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching wholesale prices:', error)
        throw new Error(error.message)
    }
    
    return data.map(item => ({
        ...item,
        supplier_name: (item.supplier as any)?.supplier_name || 'Unknown'
    }))
}

/**
 * Get data for the wholesale price dashboard table
 */
export async function getWholesaleDashboardData(params: {
    page?: number
    limit?: number
    search?: string
}) {
    const { page = 1, limit = 50, search = '' } = params
    const supabase = await createClient()

    // Calculate pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // 1. Get products
    let query = supabase
        .from('products')
        .select('*, product_combos!product_combos_parent_product_id_fkey(count)', { count: 'exact' })
        .eq('is_deleted', false)

    if (search && search.trim()) {
        query = query.ilike('product_name', `%${search.trim()}%`)
    }

    const { data: products, count, error: productsError } = await query
        .order('product_name', { ascending: true })
        .range(from, to)

    if (productsError) {
        console.error('Error fetching products for wholesale dashboard:', productsError)
        throw new Error(productsError.message)
    }
    
    if (!products || products.length === 0) return { products: [], totalCount: 0, totalPages: 0 }

    const productIds = products.map(p => p.id)

    // 2. Get lowest wholesale price for these products
    const { data: wholesalePrices, error: wholesaleError } = await supabase
        .from('product_wholesale_prices')
        .select('product_id, wholesale_price, supplier:suppliers(supplier_name)')
        .in('product_id', productIds)

    if (wholesaleError) {
        console.error('Error fetching wholesale prices for dashboard:', wholesaleError)
    }

    // 3. Get lowest purchase price for these products
    const { data: purchasePrices, error: purchaseError } = await supabase
        .from('purchases')
        .select('product_id, unit_amount, supplier:suppliers(supplier_name)')
        .in('product_id', productIds)
    
    if (purchaseError) {
        console.error('Error fetching purchase prices for dashboard:', purchaseError)
    }

    // 4. Combine and find lowest
    const enrichedProducts = products.map(product => {
        const productWholesale = wholesalePrices?.filter(wp => wp.product_id === product.id) || []
        const productPurchases = purchasePrices?.filter(pp => pp.product_id === product.id) || []

        let lastPrice: number | null = null
        let lastSupplier: string | null = null

        // Find minimum from wholesale
        productWholesale.forEach(wp => {
            const price = Number(wp.wholesale_price)
            if (lastPrice === null || price < lastPrice) {
                lastPrice = price
                lastSupplier = (wp.supplier as any)?.supplier_name || 'Unknown'
            }
        })

        // Find minimum from purchases
        productPurchases.forEach(pp => {
            const price = Number(pp.unit_amount)
            if (lastPrice === null || price < lastPrice) {
                lastPrice = price
                lastSupplier = (pp.supplier as any)?.supplier_name || 'Unknown'
            }
        })

        return {
            ...product,
            last_price: lastPrice,
            last_supplier: lastSupplier
        }
    })

    return {
        products: enrichedProducts,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

/**
 * Get latest purchase records for a product, one per supplier
 */
export async function getProductPurchasingDetails(productId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('purchases')
        .select(`
            id,
            purchase_date,
            unit_amount,
            supplier_id,
            supplier:suppliers(supplier_name)
        `)
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false })

    if (error) {
        console.error('Error fetching product purchasing details:', error)
        throw new Error(error.message)
    }

    // De-duplicate by supplier_id to get only the latest for each
    const latestBySupplierMap = new Map()
    data?.forEach(p => {
        if (!latestBySupplierMap.has(p.supplier_id)) {
            latestBySupplierMap.set(p.supplier_id, {
                ...p,
                supplier_name: (p.supplier as any)?.supplier_name || 'Unknown'
            })
        }
    })

    return Array.from(latestBySupplierMap.values())
}
