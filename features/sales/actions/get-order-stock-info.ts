'use server'

import { createClient } from '@/lib/supabase/server'

export interface ProductStockInfo {
    product_id: string
    product_name: string
    image_url: string | null
    total_stock: number
}

export interface OrderStockInfo {
    order_id: string
    products: ProductStockInfo[]
    in_stock_count: number
    total_count: number
}

/**
 * Get stock information for products in multiple orders
 * This reuses the stock calculation logic from stock-ledger-service
 */
export async function getOrdersStockInfo(orderIds: string[]): Promise<Record<string, OrderStockInfo>> {
    if (!orderIds || orderIds.length === 0) {
        return {}
    }

    const supabase = await createClient()

    // 1. Fetch all order items for the given orders
    const { data: orderItems, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select(`
            order_id,
            product_id,
            quantity,
            product:products!inner(
                id,
                id,
                product_name,
                image_url,
                product_type
            )
        `)
        .in('order_id', orderIds)

    if (itemsError) {
        console.error('Error fetching order items:', itemsError)
        return {}
    }

    if (!orderItems || orderItems.length === 0) {
        return {}
    }

    // 2. Get unique product IDs
    const productIds = [...new Set(orderItems.map(item => item.product_id))]

    // 3. Calculate stock for each product (batch processing)
    const stockMap = await calculateProductStocks(productIds)

    // 4. Group by order and build response
    const result: Record<string, OrderStockInfo> = {}

    orderIds.forEach(orderId => {
        const items = orderItems.filter(item => item.order_id === orderId)

        const products: ProductStockInfo[] = items.map(item => {
            const product = item.product as any
            return {
                product_id: item.product_id,
                product_name: product?.product_name || 'Unknown Product',
                image_url: product?.image_url || null,
                total_stock: stockMap.get(item.product_id) || 0
            }
        })

        const in_stock_count = products.filter(p => p.total_stock > 0).length

        result[orderId] = {
            order_id: orderId,
            products,
            in_stock_count,
            total_count: products.length
        }
    })

    return result
}

/**
 * Get stock for a list of products (for internal usage or independent components)
 */
export async function getProductsStock(productIds: string[]): Promise<Record<string, number>> {
    const map = await calculateProductStocks(productIds)
    return Object.fromEntries(map)
}

/**
 * Calculate total stock for multiple products
 * Uses the official stock_ledger_view to ensure consistency
 */
async function calculateProductStocks(productIds: string[]): Promise<Map<string, number>> {
    const supabase = await createClient()
    const stockMap = new Map<string, number>()

    if (productIds.length === 0) return stockMap

    // Query the optimized view directly
    const { data: stocks, error } = await supabase
        .from('stock_ledger_view')
        .select('id, total_stock')
        .in('id', productIds)

    if (error) {
        console.error('Error fetching stock_ledger_view:', error)
        return stockMap
    }

    stocks?.forEach(item => {
        stockMap.set(item.id, Number(item.total_stock) || 0)
    })

    return stockMap
}
