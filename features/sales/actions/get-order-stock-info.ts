'use server'

import { createClient } from '@/lib/supabase/server'
import { withMemoryCache } from '@/lib/cache/memory-cache'

export interface ComboItemStockInfo {
    id: string
    quantity: number
    child_product_id: string
    child: {
        id: string
        product_id?: number
        product_name: string
        image_url: string | null
        total_stock: number
    } | null
}

export interface ProductStockInfo {
    product_id: string
    product_name: string
    image_url: string | null
    total_stock: number
    product_type?: 'single' | 'combo'
    combo_items?: ComboItemStockInfo[]
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

    const sortedKey = [...orderIds].sort().join(',')
    return withMemoryCache(`order_stock_info_v3:${sortedKey}`, 30_000, async () => {
        const supabase = await createClient()

        // 1. Fetch all order items for the given orders (chunked to prevent URL length overflow)
        const CHUNK_SIZE = 150
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
                            product_type,
                            product_combos!product_combos_parent_product_id_fkey(
                                id,
                                quantity,
                                child_product_id,
                                child:products!product_combos_child_product_id_fkey(
                                    id,
                                    product_id,
                                    product_name,
                                    image_url
                                )
                            )
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

        // 2. Get unique product IDs (including combo child component IDs)
        const productIdsSet = new Set<string>()
        for (const item of orderItems) {
            if (item.product_id) productIdsSet.add(item.product_id)
            const prod = Array.isArray(item.product) ? item.product[0] : item.product
            if (Array.isArray(prod?.product_combos)) {
                for (const c of prod.product_combos) {
                    const childObj = Array.isArray(c.child) ? c.child[0] : c.child
                    const childId = childObj?.id || c.child_product_id
                    if (childId) productIdsSet.add(childId)
                }
            }
        }
        const productIds = Array.from(productIdsSet)

        // 3. Calculate stock for each product (batch processing)
        const stockMap = await calculateProductStocks(productIds)

        // 4. Group by order and build response
        const result: Record<string, OrderStockInfo> = {}
        const itemsByOrder = new Map<string, any[]>()
        for (const item of orderItems) {
            if (!itemsByOrder.has(item.order_id)) {
                itemsByOrder.set(item.order_id, [])
            }
            itemsByOrder.get(item.order_id)!.push(item)
        }

        orderIds.forEach(orderId => {
            const items = itemsByOrder.get(orderId) || []

            const products: ProductStockInfo[] = items.map(item => {
                const product = (Array.isArray(item.product) ? item.product[0] : item.product) as any
                const rawCombos = Array.isArray(product?.product_combos) ? product.product_combos : []
                const combo_items: ComboItemStockInfo[] = rawCombos.map((c: any) => {
                    const childObj = Array.isArray(c.child) ? c.child[0] : c.child
                    const childId = childObj?.id || c.child_product_id
                    return {
                        id: c.id,
                        quantity: Number(c.quantity) || 1,
                        child_product_id: childId,
                        child: childObj ? {
                            id: childObj.id,
                            product_id: childObj.product_id,
                            product_name: childObj.product_name,
                            image_url: childObj.image_url || null,
                            total_stock: stockMap.get(childObj.id) ?? 0
                        } : null
                    }
                })

                return {
                    product_id: item.product_id,
                    product_name: product?.product_name || 'Unknown Product',
                    image_url: product?.image_url || null,
                    total_stock: stockMap.get(item.product_id) || 0,
                    product_type: product?.product_type || 'single',
                    combo_items
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
    })
}

/**
 * Get stock for a list of products (for internal usage or independent components)
 */
export async function getProductsStock(productIds: string[]): Promise<Record<string, number>> {
    const map = await calculateProductStocks(productIds)
    return Object.fromEntries(map)
}

async function getAllStockTotalsMap(): Promise<Map<string, number>> {
    return withMemoryCache('stock_ledger:all_totals_map_v2', 60_000, async () => {
        const supabase = await createClient()
        const map = new Map<string, number>()
        const BATCH_SIZE = 1000

        // Fetch first 2 pages (up to 2,000 products) in parallel for speed, then continue if needed
        const [page0, page1] = await Promise.all([
            supabase.from('stock_ledger_view').select('id, total_stock').range(0, BATCH_SIZE - 1),
            supabase.from('stock_ledger_view').select('id, total_stock').range(BATCH_SIZE, BATCH_SIZE * 2 - 1)
        ])

        if (page0.error) console.error('Error fetching stock_ledger_view page 0:', page0.error)
        if (page1.error) console.error('Error fetching stock_ledger_view page 1:', page1.error)

        page0.data?.forEach((item: any) => {
            map.set(item.id, Number(item.total_stock) || 0)
        })
        page1.data?.forEach((item: any) => {
            map.set(item.id, Number(item.total_stock) || 0)
        })

        let page = 2
        let lastLen = page1.data?.length || 0
        while (lastLen === BATCH_SIZE && page < 20) {
            const { data, error } = await supabase
                .from('stock_ledger_view')
                .select('id, total_stock')
                .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

            if (error || !data || data.length === 0) break
            data.forEach((item: any) => {
                map.set(item.id, Number(item.total_stock) || 0)
            })
            lastLen = data.length
            page++
        }

        return map
    })
}

async function calculateProductStocks(rawProductIds: string[]): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>()
    const productIds = rawProductIds.filter(Boolean)
    if (productIds.length === 0) return stockMap

    const fullMap = await getAllStockTotalsMap()
    productIds.forEach(id => {
        stockMap.set(id, fullMap.get(id) ?? 0)
    })

    return stockMap
}
