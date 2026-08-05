'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ==========================================
// OPENING STOCK
// ==========================================

export interface OpeningStock {
    id: string
    date: string
    location: string
    product_id: string
    product_name?: string
    quantity: number
    remarks?: string
    created_at: string
    updated_at: string
}

// Save Opening Stock
export async function saveOpeningStock(data: {
    date: string
    location: string
    product_id: string
    quantity: number
    remarks?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('opening_stocks')
        .insert({
            date: data.date,
            location: data.location,
            product_id: data.product_id,
            quantity: data.quantity,
            remarks: data.remarks
        })

    if (error) {
        console.error('Error saving opening stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/stock-adjustment')
}

// Get Opening Stocks
export async function getOpeningStocks() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('opening_stocks')
        .select(`
            *,
            products (
                product_name
            )
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching opening stocks:', error)
        throw new Error(error.message)
    }

    return data.map((item: any) => ({
        ...item,
        product_name: item.products?.product_name || 'Unknown Product'
    })) as OpeningStock[]
}

// Update Opening Stock
export async function updateOpeningStock(id: string, data: Partial<OpeningStock>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('opening_stocks')
        .update({
            date: data.date,
            location: data.location,
            quantity: data.quantity,
            remarks: data.remarks,
            product_id: data.product_id,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating opening stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/stock-adjustment')
}

// Delete Opening Stock
export async function deleteOpeningStock(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('opening_stocks')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting opening stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/stock-adjustment')
}

// ==========================================
// MANUAL ADJUSTMENT
// ==========================================

export interface ManualAdjustment {
    id: string
    date: string
    location: string
    product_id: string
    product_name?: string
    quantity: number
    reason?: string
    created_at: string
    updated_at: string
}

// Save Manual Adjustment
export async function saveManualAdjustment(data: {
    date: string
    location: string
    product_id: string
    quantity: number
    reason?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('manual_adjustments')
        .insert({
            date: data.date,
            location: data.location,
            product_id: data.product_id,
            quantity: data.quantity,
            reason: data.reason
        })

    if (error) {
        console.error('Error saving manual adjustment:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/stock-adjustment')
}

// Get Manual Adjustments
export async function getManualAdjustments() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('manual_adjustments')
        .select(`
            *,
            products (
                product_name
            )
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching manual adjustments:', error)
        throw new Error(error.message)
    }

    return data.map((item: any) => ({
        ...item,
        product_name: item.products?.product_name || 'Unknown Product'
    })) as ManualAdjustment[]
}

// Update Manual Adjustment
export async function updateManualAdjustment(id: string, data: Partial<ManualAdjustment>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('manual_adjustments')
        .update({
            date: data.date,
            location: data.location,
            quantity: data.quantity,
            reason: data.reason,
            product_id: data.product_id,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating manual adjustment:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/stock-adjustment')
}

// Delete Manual Adjustment
export async function deleteManualAdjustment(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('manual_adjustments')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting manual adjustment:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/stock-adjustment')
}

// ==========================================
// AUTO ADJUSTMENT
// ==========================================

export interface AutoAdjustmentComponent {
    name: string
    qty_display: number // The calculated total quantity (component qty * sale qty)
    stock_display: string // The signed string for Stock column e.g. "-5", "+5"
    stock_effect: 'positive' | 'negative' | 'neutral'
}

export interface AutoAdjustment {
    id: string // composite id: source-orderId-productId
    date: string
    combo_product_name: string
    source: 'Daraz' | 'Marketplace' | 'Store Sales'
    status: string
    created_by_name: string
    components: AutoAdjustmentComponent[]
}

export async function getAutoAdjustments() {
    const supabase = await createClient()

    // Common selection for product combos
    const PRODUCT_FIELDS = `
        id,
        product_name,
        product_type,
        product_combos!product_combos_parent_product_id_fkey (
            quantity,
            child:products!product_combos_child_product_id_fkey (
                product_name
            )
        )
    `
    const PRODUCT_SELECT = `product:products!inner (${PRODUCT_FIELDS})`

    // 1. Fetch sales from Daraz
    // Removed user_profiles join as FK is missing
    const { data: darazItems, error: darazError } = await supabase
        .from('daraz_order_items')
        .select(`
            id,
            quantity,
            order:daraz_orders (
                id,
                order_date,
                order_status
            ),
            ${PRODUCT_SELECT}
        `)
        .in('product.product_type', ['combo', 'variation'])
        .order('created_at', { ascending: false })
        .limit(50)

    if (darazError) console.error('Error fetching daraz auto-adjust items:', darazError)

    // 2. Fetch sales from Marketplace
    // Used explicit hint as requested by error message
    const { data: marketplaceItems, error: marketplaceError } = await supabase
        .from('marketplace_order_items')
        .select(`
            id,
            quantity,
            order:marketplace_orders (
                id,
                order_date,
                order_status,
                created_user:user_profiles!marketplace_orders_created_by_fkey(full_name)
            ),
            ${PRODUCT_SELECT}
        `)
        .in('product.product_type', ['combo', 'variation'])
        .order('created_at', { ascending: false })
        .limit(50)

    if (marketplaceError) console.error('Error fetching marketplace auto-adjust items:', marketplaceError)

    // 3. Fetch sales from Store Sales
    // Removed user_profiles join as FK is missing
    const { data: storeItemsRaw, error: storeError } = await supabase
        .from('store_sales_items')
        .select(`
            id,
            qty,
            product_id,
            sale:store_sales (
                id,
                sale_date
            )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

    if (storeError) console.error('Error fetching store sales auto-adjust items:', storeError)

    // 3b. Manually enrich Store Sales with Product Info
    let storeItemsProcessed: any[] = []
    if (storeItemsRaw && storeItemsRaw.length > 0) {
        // Collect IDs
        const productIds = Array.from(new Set(storeItemsRaw.map(i => (i as any).product_id).filter(Boolean)))

        if (productIds.length > 0) {
            const { data: products } = await supabase
                .from('products')
                .select(PRODUCT_FIELDS)
                .in('id', productIds)
                .in('product_type', ['combo', 'variation'])

            const productMap = new Map((products || []).map(p => [p.id, p]))

            // Filter items that match our Combo/Variation criteria
            storeItemsProcessed = storeItemsRaw.map((item: any) => ({
                ...item,
                product: productMap.get(item.product_id)
            })).filter(item => item.product) // Only keep if product found and is combo/variation
        }
    }

    // 4. Process and Group
    // Key: source-orderId-productId
    const groupedResults = new Map<string, AutoAdjustment>()

    const processItems = (items: any[], source: 'Daraz' | 'Marketplace' | 'Store Sales') => {
        if (!items) return

        items.forEach(item => {
            const isStoreSale = source === 'Store Sales'
            const order = isStoreSale ? item.sale : item.order

            if (!order) return

            const product = item.product
            const comboComponents = product.product_combos || []
            const salesQty = isStoreSale ? item.qty : item.quantity
            const creator = order.created_user?.full_name || 'Unknown'

            // Status Logic
            let status = 'Delivered' // Default for Store Sales
            if (!isStoreSale) {
                status = order.order_status || 'Pending'
            }

            // Key for grouping: An order can have multiple different combo products, they should be separate rows.
            // But if an order has the SAME combo product twice (separate line items), usually they are merged in qty or strict separate lines.
            // Assuming separate line items should be consolidated if strictly same product? Or separate? 
            // Let's make key unique to the line item ID to be safe and simple, BUT User request specifically asked for "Date... Component List... Qty List... Combo Product...".
            // It strongly implies grouping by the Order Item (Sale Item).
            // So Key = source + item.id is sufficient because item.id is unique for the Order Item.
            // Wait, if I sell 2 "Gift Sets", it's 1 line item with quantity 2. Grouping by item.id handles this (1 row, components multiplied).
            // This matches the logic perfectly.

            const uniqueKey = `${source}-${item.id}`

            // Stock Calculation Logic
            let stockEffect: 'positive' | 'negative' | 'neutral' = 'neutral'

            if (['Shipped', 'Delivered', 'Returning to Seller'].includes(status) || status === 'Completed') {
                stockEffect = 'negative'
            } else if (['Fail Delivered', 'Failed Delivery', 'Customer Return', 'Returned', 'Return', 'Returned Delivered', 'Customer Return Delivered'].includes(status)) {
                stockEffect = 'positive'
            } else {
                stockEffect = 'neutral'
            }

            const components: AutoAdjustmentComponent[] = []

            comboComponents.forEach((comp: any) => {
                const componentName = comp.child?.product_name || 'Unknown Component'
                const componentQtyPerUnit = comp.quantity
                const totalQty = salesQty * componentQtyPerUnit // Calculation: Comp Qty * Order Qty

                let stockDisplay = '0'
                if (stockEffect === 'negative') {
                    stockDisplay = `-${totalQty}`
                } else if (stockEffect === 'positive') {
                    stockDisplay = `+${totalQty}`
                } else {
                    stockDisplay = '0'
                }

                components.push({
                    name: componentName,
                    qty_display: totalQty,
                    stock_display: stockDisplay,
                    stock_effect: stockEffect
                })
            })

            groupedResults.set(uniqueKey, {
                id: uniqueKey,
                date: isStoreSale ? order.sale_date : order.order_date,
                combo_product_name: product.product_name,
                source: source,
                status: status,
                created_by_name: creator,
                components: components
            })
        })
    }

    processItems(darazItems || [], 'Daraz')
    processItems(marketplaceItems || [], 'Marketplace')
    processItems(storeItemsProcessed, 'Store Sales')

    // Sort by Date Descending
    return Array.from(groupedResults.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
