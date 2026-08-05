'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface InventoryPriceReportItem {
    product_id: string
    product_code?: number // Added for display
    product_name: string
    product_type?: 'combo' | 'single' // Added for type icons
    image_url: string | null
    est_price: number | null
    is_combo_calculated?: boolean // Flag for auto-calculated combo prices
    last_price: number | null
    low_price: number | null
    high_price: number | null
    average_price: number | null
    // Added for search
    seller_sku1?: string | null
    seller_sku2?: string | null
    seller_sku3?: string | null
    seller_sku4?: string | null
    // For combo count (to differentiate variation vs combo)
    product_combos?: Array<{ count: number }> | null
}

export interface GetPriceReportsParams {
    page?: number
    limit?: number
    search?: string
}

export async function getInventoryPriceReports(params: GetPriceReportsParams) {
    const { page = 1, limit = 100, search } = params
    const supabase = await createClient()

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('inventory_price_reports_view')
        .select('*', { count: 'exact' })

    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        // The view might not have SKUs, so we search the products table first
        const { data: matchedProducts } = await supabase
            .from('products')
            .select('id')
            .or(`product_name.ilike.${searchTerm},seller_sku1.ilike.${searchTerm},seller_sku2.ilike.${searchTerm},seller_sku3.ilike.${searchTerm},seller_sku4.ilike.${searchTerm}`)
            
        if (matchedProducts && matchedProducts.length > 0) {
            const matchedIds = matchedProducts.map(p => p.id)
            query = query.in('product_id', matchedIds)
        } else {
            // Force empty result if no match
            query = query.eq('product_id', '00000000-0000-0000-0000-000000000000')
        }
    }

    query = query
        .order('product_name', { ascending: true })
        .range(from, to)

    const { data, count, error } = await query

    if (error) {
        console.error('Error fetching price reports:', error)
        throw new Error('Failed to fetch price reports')
    }

    // Fetch product types and combo counts for the returned products
    const productIds = (data || []).map((item: any) => item.product_id)

    let productTypesMap: Record<string, { product_type: string, combo_count?: number }> = {}
    let comboEstPricesMap: Record<string, number> = {} // Store calculated est_prices for combo products

    if (productIds.length > 0) {
        // Fetch product types
        const { data: productsData } = await supabase
            .from('products')
            .select('id, product_type')
            .in('id', productIds)

        // Fetch combo components (child products and quantities)
        const { data: combosData } = await supabase
            .from('product_combos')
            .select('parent_product_id, child_product_id, quantity')
            .in('parent_product_id', productIds)

        // Build the product types map
        productsData?.forEach((p: any) => {
            productTypesMap[p.id] = { product_type: p.product_type }
        })

        // Process combo data
        const comboComponentsMap: Record<string, Array<{ child_product_id: string, quantity: number }>> = {}

        combosData?.forEach((c: any) => {
            if (!comboComponentsMap[c.parent_product_id]) {
                comboComponentsMap[c.parent_product_id] = []
            }
            comboComponentsMap[c.parent_product_id].push({
                child_product_id: c.child_product_id,
                quantity: c.quantity
            })
        })

        // Set combo_count based on number of components
        Object.keys(comboComponentsMap).forEach(parentId => {
            if (productTypesMap[parentId]) {
                productTypesMap[parentId].combo_count = comboComponentsMap[parentId].length
            }
        })

        // Fetch est_prices for all child products in combos
        const allChildProductIds = Object.values(comboComponentsMap)
            .flat()
            .map(comp => comp.child_product_id)
            .filter((id, index, self) => self.indexOf(id) === index) // unique

        if (allChildProductIds.length > 0) {
            const { data: childPricesData } = await supabase
                .from('inventory_price_reports_view')
                .select('product_id, est_price, last_price')
                .in('product_id', allChildProductIds)

            const childEstPricesMap: Record<string, number> = {}
            childPricesData?.forEach((p: any) => {
                childEstPricesMap[p.product_id] = p.est_price || p.last_price || 0
            })

            // Calculate est_price for each combo product
            Object.keys(comboComponentsMap).forEach(parentId => {
                const components = comboComponentsMap[parentId]
                const calculatedEstPrice = components.reduce((sum, comp) => {
                    const childEstPrice = childEstPricesMap[comp.child_product_id] || 0
                    return sum + (comp.quantity * childEstPrice)
                }, 0)
                comboEstPricesMap[parentId] = calculatedEstPrice
            })
        }

        // Auto-save calculated combo prices to database
        const comboUpdates = Object.entries(comboEstPricesMap).map(async ([productId, calculatedPrice]) => {
            if (calculatedPrice > 0) {
                const { error } = await supabase
                    .from('products')
                    .update({ est_price: calculatedPrice })
                    .eq('id', productId)

                if (error) {
                    console.error(`❌ [AUTO-SAVE] Failed to save combo price for ${productId}:`, error)
                }
                return { productId, success: !error }
            }
            return { productId, success: false, reason: 'price is 0' }
        })

        // Wait for all updates to complete
        const results = await Promise.all(comboUpdates)
    }

    // Merge the data with calculated combo prices
    const transformedData = (data || []).map((item: any) => {
        const productType = productTypesMap[item.product_id]?.product_type || 'single'
        const isCombo = productType === 'combo'

        return {
            ...item,
            product_type: productType,
            // Use calculated est_price for combo products, original for others
            est_price: isCombo ? (comboEstPricesMap[item.product_id] || item.est_price || 0) : item.est_price,
            is_combo_calculated: isCombo,
            product_combos: productTypesMap[item.product_id]?.combo_count
                ? [{ count: productTypesMap[item.product_id].combo_count }]
                : null
        }
    })

    return {
        data: transformedData as InventoryPriceReportItem[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

export async function updateProductEstPrice(productId: string, estPrice: number) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('products')
        .update({ est_price: estPrice })
        .eq('id', productId)

    if (error) {
        console.error('Error updating est price:', error)
        throw new Error('Failed to update estimated price')
    }

    revalidatePath('/dashboard/purchase/inventory-price-reports')
    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true }
}

export async function bulkUpdateEstPrices(updates: Array<{ product_code: string, est_price: number }>) {
    const supabase = await createClient()

    // First, fetch all products to map product_code to product_id
    const productCodes = updates.map(u => parseInt(u.product_code)).filter(code => !isNaN(code))

    const { data: products, error: fetchError } = await supabase
        .from('inventory_price_reports_view')
        .select('product_id, product_code')
        .in('product_code', productCodes)

    if (fetchError) {
        console.error('Error fetching products:', fetchError)
        throw new Error('Failed to fetch products')
    }

    // Create a map of product_code to product_id
    const codeToIdMap = new Map<string, string>()
    products?.forEach(p => {
        if (p.product_code) {
            codeToIdMap.set(p.product_code.toString(), p.product_id)
        }
    })

    // Update each product
    const results = await Promise.allSettled(
        updates.map(async ({ product_code, est_price }) => {
            const product_id = codeToIdMap.get(product_code)

            if (!product_id) {
                throw new Error(`Product code ${product_code} not found`)
            }

            const { error } = await supabase
                .from('products')
                .update({ est_price })
                .eq('id', product_id)

            if (error) {
                console.error(`Error updating product ${product_code}:`, error)
                throw error
            }
            return { product_code, success: true }
        })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    revalidatePath('/dashboard/purchase/inventory-price-reports')
    revalidatePath('/dashboard/sales/daraz/average-sales-price')

    return {
        success: true,
        total: updates.length,
        successful,
        failed
    }
}
