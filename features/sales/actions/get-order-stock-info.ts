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

    // 1. Fetch all order items for the given orders (chunked to prevent URL length overflow)
    const CHUNK_SIZE = 50
    const chunks: string[][] = []
    for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        chunks.push(orderIds.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
        chunks.map(chunk =>
            supabase
                .from('daraz_order_items')
                .select(`
                    order_id,
                    product_id,
                    quantity,
                    product:products(
                        id,
                        product_name,
                        image_url,
                        product_type
                    )
                `)
                .in('order_id', chunk)
        )
    )

    const orderItems: any[] = []
    for (const res of chunkResults) {
        if (res.error) {
            console.error('Error fetching order items chunk:', res.error)
        }
        if (res.data) {
            orderItems.push(...res.data)
        }
    }

    if (orderItems.length === 0) {
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

// In-memory cache for product stocks with 30s TTL to speed up repeated order stock lookups
const stockCache = new Map<string, { stock: number; timestamp: number }>()
const STOCK_CACHE_TTL = 30 * 1000 // 30 seconds

async function calculateProductStocks(rawProductIds: string[]): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>()
    const productIds = rawProductIds.filter(Boolean)
    if (productIds.length === 0) return stockMap

    const now = Date.now()
    const missingIds: string[] = []

    // Read from in-memory cache if fresh
    productIds.forEach(id => {
        const cached = stockCache.get(id)
        if (cached && (now - cached.timestamp) < STOCK_CACHE_TTL) {
            stockMap.set(id, cached.stock)
        } else {
            missingIds.push(id)
        }
    })

    if (missingIds.length === 0) {
        return stockMap
    }

    const supabase = await createClient()

    // Query only the uncached products in chunks to prevent URL length overflow
    const CHUNK_SIZE = 50
    const chunks: string[][] = []
    for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
        chunks.push(missingIds.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
        chunks.map(chunk =>
            supabase
                .from('stock_ledger_view')
                .select('id, total_stock')
                .in('id', chunk)
        )
    )

    for (const res of chunkResults) {
        if (res.error) {
            console.error('Error fetching stock_ledger_view chunk:', res.error)
        }
        res.data?.forEach(item => {
            const stockVal = Number(item.total_stock) || 0
            stockMap.set(item.id, stockVal)
            stockCache.set(item.id, { stock: stockVal, timestamp: now })
        })
    }

    return stockMap
}
