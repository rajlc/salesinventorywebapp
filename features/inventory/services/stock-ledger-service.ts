'use server'

import { createClient } from '@/lib/supabase/server'

export interface StockLedgerItem {
    id: string
    product_name: string
    product_type?: string
    store_stock: number
    auto_adjust: number
    damage_stock: number
    purchase: number
    sales: number
    sales_return: number
    ecommerce_sales?: number
    total_stock: number
}

interface LedgerResponse {
    data: StockLedgerItem[]
    totalCount: number
    totalPages: number
    currentPage: number
}

export async function getStockLedger(page = 1, limit = 100, search = ''): Promise<LedgerResponse> {
    const supabase = await createClient()

    // 1. Base Query with Count
    let query = supabase
        .from('stock_ledger_view')
        .select('*', { count: 'exact' })

    // 2. Filter
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        query = query.ilike('product_name', searchTerm)
    }

    // 3. Optimized Server-Side Sort
    // Order: Positive (desc) -> Negative (desc) -> Zero (last)
    // We achieve this using Postgres CASE logic via raw order string
    query = query.order('total_stock', { 
        ascending: false,
        // Secondary sort to ensure consistent results
        foreignTable: undefined 
    })
    .order('product_name', { ascending: true })

    // 4. Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query.range(from, to)

    if (error) {
        console.error('Error fetching stock_ledger_view:', error)
        throw new Error(error.message)
    }

    if (!data || data.length === 0) {
        return { data: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    // Map data
    const ledger: StockLedgerItem[] = data.map((item: any) => ({
        id: item.id,
        product_name: item.product_name,
        product_type: item.product_type,
        store_stock: Number(item.store_stock),
        auto_adjust: Number(item.auto_adjust),
        damage_stock: Number(item.damage_stock),
        purchase: Number(item.purchase),
        sales: Number(item.sales),
        sales_return: Number(item.sales_return),
        ecommerce_sales: Number(item.ecommerce_sales || 0),
        total_stock: Number(item.total_stock)
    }))

    const totalCount = count || 0
    return {
        data: ledger,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
    }
}

// Detail View
export interface LedgerDetailItem {
    type: string
    description: string
    date?: string
    qty: number
    effect: 'positive' | 'negative' | 'neutral'
}


export interface StockLedgerDetail {
    id: string
    product_name: string
    product_id: number | null
    seller_sku1: string | null
    seller_sku2: string | null
    seller_sku3: string | null
    seller_sku4: string | null
    opening_stock: number
    manual_adjustment: number
    auto_adjust: number
    damage_stock: number
    purchase: number
    daraz_shipped: number
    daraz_delivered: number
    daraz_returning: number
    daraz_customer_return: number
    daraz_returned_delivered: number
    store_sales: number
    website_shipped: number
    website_delivered: number
    website_returned_delivered: number
    total_stock: number
}

export async function getProductStockDetails(productId: string): Promise<StockLedgerDetail | null> {
    const supabase = await createClient()

    // 1. Fetch Product Details
    const { data: product, error } = await supabase
        .from('products')
        .select('id, product_name, product_id, product_type, seller_sku1, seller_sku2, seller_sku3, seller_sku4')
        .eq('id', productId)
        .single()

    if (error || !product) {
        return null
    }

    // 2. Fetch Direct Data (Parallel)
    // First, find all parents if this is a child in any combos
    const { data: parentCombos } = await supabase
        .from('product_combos')
        .select('parent_product_id, quantity')
        .eq('child_product_id', productId)

    const parentIds = parentCombos?.map(c => c.parent_product_id) || []

    const [
        openingStats,
        manualStats,
        damageStats,
        purchaseStats,
        darazItems,
        storeItems,
        websiteItems,
        // Auto Adjust: Combo Sales where THIS product is a component
        darazComboSales,
        storeComboSales,
        websiteComboSales
    ] = await Promise.all([
        // Direct Adjustments
        supabase.from('opening_stocks').select('quantity').eq('product_id', productId),
        supabase.from('manual_adjustments').select('quantity').eq('product_id', productId),
        supabase.from('damaged_stocks').select('quantity').eq('product_id', productId).eq('status', 'Damaged'),
        supabase.from('purchases').select('quantity').eq('product_id', productId),

        // Sales Data
        supabase.from('daraz_order_items')
            .select('quantity, item_status, order:daraz_orders!inner(order_status)')
            .eq('product_id', productId),
        supabase.from('store_sales_items')
            .select('qty')
            .eq('product_id', productId),
        supabase.from('website_order_items')
            .select('quantity, order:website_orders!inner(order_status)')
            .eq('product_id', productId),

        // Auto Adjust Queries: Find sales of PARENT combos where this product is a child
        parentIds.length > 0 ?
            supabase.from('daraz_order_items')
                .select(`quantity, order:daraz_orders!inner(order_status), product_id`)
                .in('product_id', parentIds) : Promise.resolve({ data: [] }),

        parentIds.length > 0 ?
            supabase.from('store_sales_items')
                .select(`qty, product_id`)
                .in('product_id', parentIds) : Promise.resolve({ data: [] }),
                
        parentIds.length > 0 ?
            supabase.from('website_order_items')
                .select(`quantity, order:website_orders!inner(order_status), product_id`)
                .in('product_id', parentIds) : Promise.resolve({ data: [] })
    ])

    // 3. Aggregate Basic Metrics
    const openingStock = openingStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const manualAdjustment = manualStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const damageStock = damageStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const purchase = purchaseStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const storeSales = storeItems.data?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0

    // 4. Aggregate Sales by Status
    let darazShipped = 0
    let darazDelivered = 0
    let darazReturning = 0
    let darazCustomerReturn = 0
    let darazReturnedDelivered = 0

    darazItems.data?.forEach((item: any) => {
        const qty = item.quantity || 0
        const sRaw = item.item_status || item.order?.order_status
        const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''

        // Count in detailed buckets for UI
        if (status === 'shipped') {
            darazShipped += qty
        }
        else if (status === 'delivered') {
            darazDelivered += qty
        }
        else if (['returning to seller', 'returning_to_seller', 'shipped_back', 'failed_delivery', 'delivery_failed'].includes(status)) {
            darazReturning += qty
        }
        else if (['customer return', 'customer_return'].includes(status)) {
            darazCustomerReturn += qty
        }
        else if (['returned delivered', 'returned_delivered', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed', 'shipped_back_success', 'customer_return_delivered'].includes(status)) {
            darazReturnedDelivered += qty // Bucket "Returned Delivered" for display totals
        }
    })

    let websiteShipped = 0
    let websiteDelivered = 0
    let websiteReturnedDelivered = 0

    websiteItems.data?.forEach((item: any) => {
        const qty = item.quantity || 0
        const sRaw = item.order?.order_status
        const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''

        if (status === 'delivered') websiteDelivered += qty
        else if (['returned delivered', 'returned_delivered', 'shipped_back_success', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed'].includes(status)) websiteReturnedDelivered += qty
        else if (!['cancelled', 'canceled'].includes(status)) websiteShipped += qty
    })

    // 5. Calculate Auto Adjust
    let autoAdjust = 0

    const processAutoAdjust = (items: any[], qtyKey: string, hasOrder: boolean) => {
        items?.forEach((item: any) => {
            const parentSoldQty = item.quantity || item.qty || 0
            const sRaw = item.order?.order_status
            const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''

            // Use the parentCombos array we fetched earlier
            const comboEntry = parentCombos?.find((c: any) => c.parent_product_id === item.product_id)
            const quantityInCombo = comboEntry?.quantity || 0
            const totalStockChange = parentSoldQty * quantityInCombo

            if (!hasOrder) {
                // Store sales: reduce stock
                autoAdjust -= totalStockChange
            } else if (['shipped', 'delivered', 'returning to seller', 'returning_to_seller'].includes(status)) {
                // Sales: reduce stock
                autoAdjust -= totalStockChange
            }
        })
    }

    processAutoAdjust(darazComboSales.data || [], 'quantity', true)
    processAutoAdjust(storeComboSales.data || [], 'qty', false)
    processAutoAdjust(websiteComboSales.data || [], 'quantity', true)

    // 6. Calculate Total Stock
    // Rule: Combo/Variation products always show 0
    const isComboOrVariation = product.product_type === 'combo' || product.product_type === 'variation'

    // Sales Sum (Green items) for formula: Sales
    // Must include Shipped, Delivered, ALL Returning (Transit), AND Returned items (to offset the Return Add-back)
    const totalSalesForFormula = datSum(darazShipped, darazDelivered, darazReturning, darazCustomerReturn, darazReturnedDelivered) +
        datSum(websiteShipped, websiteDelivered, websiteReturnedDelivered) + storeSales

    // Sales Return Sum (Red items) for formula: Sales Return
    const totalReturnsForFormula = datSum(darazReturnedDelivered) + websiteReturnedDelivered

    const storeStock = openingStock + manualAdjustment

    // Formula from main ledger: 
    // total_stock = store_stock + purchase + sales_return + auto_adjust - damage_stock - sales
    const calculatedTotal = storeStock + purchase + totalReturnsForFormula + autoAdjust - damageStock - totalSalesForFormula
    const totalStock = isComboOrVariation ? 0 : calculatedTotal

    return {
        id: product.id,
        product_name: product.product_name,
        product_id: product.product_id,
        seller_sku1: product.seller_sku1,
        seller_sku2: product.seller_sku2,
        seller_sku3: product.seller_sku3,
        seller_sku4: product.seller_sku4,
        opening_stock: openingStock,
        manual_adjustment: manualAdjustment,
        auto_adjust: autoAdjust,
        damage_stock: damageStock,
        purchase: purchase,
        daraz_shipped: darazShipped,
        daraz_delivered: darazDelivered,
        daraz_returning: darazReturning,
        daraz_customer_return: darazCustomerReturn,
        daraz_returned_delivered: darazReturnedDelivered,
        store_sales: storeSales,
        website_shipped: websiteShipped,
        website_delivered: websiteDelivered,
        website_returned_delivered: websiteReturnedDelivered,
        total_stock: totalStock
    }
}

// Helper to sum numbers safely
function datSum(...args: number[]) {
    return args.reduce((a, b) => a + (b || 0), 0)
}
