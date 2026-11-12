import { createAdminClient } from '@/lib/supabase/server'
import {
    calculateDarazFeeBreakdown,
    type OtherFeeItem
} from '@/features/sales/utils/daraz-fee-calculator'
import { getDarazOtherFees } from '@/features/sales/actions/daraz-commission-actions'
import { withMemoryCache, invalidateMemoryCachePrefix } from '@/lib/cache/memory-cache'

export interface ItemProfitDetail {
    itemId?: string
    sellerSku: string
    productName: string
    productId: string | null
    quantity: number
    unitAmount: number
    totalSales: number
    purchasingPrice: number
    totalCost: number
    commissionRate: number | null
    effectiveCommissionRate: number | null
    totalDeductions: number
    netPayout: number
    profit: number | null
    status: 'profit' | 'loss' | 'receivable' | 'invalid'
    invalidReason?: string
}

export interface OrderProfitInfo {
    status: 'profit' | 'loss' | 'receivable' | 'invalid'
    profitAmount: number | null
    receivableAmount: number | null
    display: string
    tooltip: string
    items: ItemProfitDetail[]
}

// In-memory cache for category commissions and other fees to avoid repetitive database overhead
let cachedCategoryCommissionMap: Map<string, number> | null = null
let cachedCategoryCommissionTime = 0
const COMMISSIONS_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

let cachedOtherFees: OtherFeeItem[] | null = null
let cachedOtherFeesTime = 0
const OTHER_FEES_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// In-memory cache for combos and wholesale prices
let cachedCombosMap: Map<string, Array<{ child_product_id: string, quantity: number }>> | null = null
let cachedWholesaleMap: Map<string, number> | null = null
let cachedCombosAndWholesaleTime = 0
const COMBOS_WHOLESALE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

// In-memory cache for product purchases & price reports
const cachedPurchasesMap = new Map<string, { price: number, time: number }>()
const cachedViewPurchasesMap = new Map<string, { price: number, time: number }>()
const PURCHASES_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// In-memory cache for full active products catalog & price reports view
let cachedCatalogIdMap: Map<string, any> | null = null
let cachedCatalogSkuMap: Map<string, any> | null = null
let cachedCatalogTime = 0
const CATALOG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

let cachedFullPriceViewMap: Map<string, number> | null = null
let cachedFullPriceViewTime = 0

/**
 * Fetch and cache full category commissions map with pagination (all 5,200+ categories)
 */
async function getCategoryCommissionMap(supabase: any): Promise<Map<string, number>> {
    const now = Date.now()
    if (cachedCategoryCommissionMap && (now - cachedCategoryCommissionTime) < COMMISSIONS_CACHE_TTL) {
        return cachedCategoryCommissionMap
    }

    try {
        const { count, error: countErr } = await supabase
            .from('daraz_category_commissions')
            .select('*', { count: 'exact', head: true })

        const totalCount = count || 0
        const BATCH_SIZE = 1000
        const totalPages = Math.ceil(totalCount / BATCH_SIZE) || 1
        const promises = []

        for (let page = 0; page < totalPages; page++) {
            promises.push(
                supabase
                    .from('daraz_category_commissions')
                    .select('leaf_category, category_path, commission_rate')
                    .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)
            )
        }

        const results = await Promise.all(promises)
        const map = new Map<string, number>()

        results.forEach(res => {
            if (res.data) {
                res.data.forEach((c: any) => {
                    const rate = Number(c.commission_rate)
                    if (!isNaN(rate)) {
                        if (c.leaf_category) {
                            map.set(c.leaf_category.toLowerCase().trim(), rate)
                        }
                        if (c.category_path) {
                            const p = c.category_path.toLowerCase().trim()
                            map.set(p, rate)
                            map.set(p.replace(/\s*>\s*/g, ' > '), rate)
                        }
                    }
                })
            }
        })

        cachedCategoryCommissionMap = map
        cachedCategoryCommissionTime = now
        return map
    } catch (e) {
        console.error('Error fetching category commissions in order profit calculator:', e)
        return new Map<string, number>()
    }
}

/**
 * Fetch and cache Daraz Other Fees
 */
async function getCachedOtherFees(): Promise<OtherFeeItem[]> {
    const now = Date.now()
    if (cachedOtherFees && (now - cachedOtherFeesTime) < OTHER_FEES_CACHE_TTL) {
        return cachedOtherFees
    }

    try {
        const fees = await getDarazOtherFees()
        cachedOtherFees = fees
        cachedOtherFeesTime = now
        return fees
    } catch (e) {
        console.error('Error fetching other fees in order profit calculator:', e)
        return []
    }
}

/**
 * Clear in-memory caches when products or commissions are updated
 */
export function clearOrderProfitCalculatorCache() {
    cachedCategoryCommissionMap = null
    cachedCategoryCommissionTime = 0
    cachedOtherFees = null
    cachedOtherFeesTime = 0
    cachedCombosMap = null
    cachedWholesaleMap = null
    cachedCombosAndWholesaleTime = 0
    cachedCatalogIdMap = null
    cachedCatalogSkuMap = null
    cachedCatalogTime = 0
    cachedFullPriceViewMap = null
    cachedFullPriceViewTime = 0
    cachedPurchasesMap.clear()
    cachedViewPurchasesMap.clear()
    invalidateMemoryCachePrefix('profit_calc:')
}

/**
 * Helper to match category commission identically to Average Sales Price
 */
function resolveCategoryCommission(product: any, commissionMap: Map<string, number>): number | null {
    if (!product) return null

    let exactComm: number | null = null

    // 1. Priority 1: Exact full category path match
    if (product.category_path) {
        const pathKey = product.category_path.toLowerCase().trim()
        if (commissionMap.has(pathKey)) {
            exactComm = commissionMap.get(pathKey)!
        } else {
            const normalized = pathKey.replace(/\s*>\s*/g, ' > ')
            if (commissionMap.has(normalized)) {
                exactComm = commissionMap.get(normalized)!
            }
        }
    }

    // 2. Priority 2: Leaf category name or marketplace category match
    if (exactComm === null && (product.category_name || product.marketplace_category)) {
        const raw = (product.category_name || product.marketplace_category).toLowerCase().trim()
        if (commissionMap.has(raw)) {
            exactComm = commissionMap.get(raw)!
        } else {
            for (const [k, v] of Array.from(commissionMap.entries())) {
                if (k.includes(raw) || raw.includes(k)) {
                    exactComm = v
                    break
                }
            }
        }
    }

    if (exactComm !== null) {
        return exactComm
    }

    // 3. Fallback to commission_percent on products table if set and not default 25
    if (product.commission_percent !== null && product.commission_percent !== undefined) {
        const pComm = Number(product.commission_percent)
        if (!isNaN(pComm) && pComm > 0) {
            return pComm
        }
    }

    return null
}

/**
 * Calculate profit, receivable or invalid status for an array of Daraz orders
 */
export async function calculateOrderProfitsForOrders(orders: any[], allItems: any[]): Promise<any[]> {
    if (!orders || orders.length === 0) {
        return orders
    }

    const supabase = await createAdminClient()

    // 1. Extract unique SKUs and product IDs from all order items
    const rawSkus = new Set<string>()
    const rawProductIds = new Set<string>()

    allItems.forEach(item => {
        if (item.seller_sku) {
            rawSkus.add(String(item.seller_sku).trim().toLowerCase())
        }
        if (item.product_id) {
            rawProductIds.add(String(item.product_id).trim())
        }
    })

    const skuList = Array.from(rawSkus)
    const productIdList = Array.from(rawProductIds)

    // 2. Fetch category commissions, other fees, products catalog, combos/wholesale, and price view concurrently
    // Using globalThis-backed withMemoryCache so caches survive HMR and coalesce concurrent requests
    const [
        commissionMap,
        otherFees,
        catalogMaps,
        combosAndWholesale,
        viewPurchasesMap
    ] = await Promise.all([
        withMemoryCache('profit_calc:commissions_map_v2', COMMISSIONS_CACHE_TTL, () => getCategoryCommissionMap(supabase)),
        withMemoryCache('profit_calc:other_fees_v2', OTHER_FEES_CACHE_TTL, () => getCachedOtherFees()),
        withMemoryCache('profit_calc:catalog_maps_v2', CATALOG_CACHE_TTL, async () => {
            const allProducts: any[] = []
            const BATCH_SIZE = 1000
            let page = 0

            while (page < 50) {
                const { data: batch, error: prodErr } = await supabase
                    .from('products')
                    .select('id, product_name, category_name, category_path, marketplace_category, seller_sku1, seller_sku2, seller_sku3, seller_sku4, commission_percent, est_price')
                    .eq('is_deleted', false)
                    .order('id')
                    .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

                if (prodErr) {
                    console.error('[OrderProfit] Error fetching products page:', prodErr)
                    break
                }
                if (!batch || batch.length === 0) break
                allProducts.push(...batch)
                if (batch.length < BATCH_SIZE) break
                page++
            }

            const skuMap = new Map<string, any>()
            const idMap = new Map<string, any>()
            const nameMap = new Map<string, any>()

            allProducts.forEach((p: any) => {
                idMap.set(p.id, p)
                if (p.product_name) {
                    const normName = String(p.product_name).trim().toLowerCase()
                    if (normName && !nameMap.has(normName)) {
                        nameMap.set(normName, p)
                    }
                }
                ;[p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4].forEach(sku => {
                    if (sku) {
                        const raw = String(sku).trim().toLowerCase()
                        if (raw) {
                            skuMap.set(raw, p)
                            if (raw.includes(',')) {
                                raw.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
                                    if (!skuMap.has(part)) skuMap.set(part, p)
                                })
                            }
                        }
                    }
                })
            })
            return { idToProductMap: idMap, skuToProductMap: skuMap, nameToProductMap: nameMap }
        }),
        withMemoryCache('profit_calc:combos_wholesale', COMBOS_WHOLESALE_CACHE_TTL, async () => {
            const [combosRes, wholesaleRes] = await Promise.all([
                supabase
                    .from('product_combos')
                    .select('parent_product_id, child_product_id, quantity')
                    .limit(10000),
                supabase
                    .from('product_wholesale_prices')
                    .select('product_id, wholesale_price')
                    .limit(10000)
            ])

            const comboMap = new Map<string, Array<{ child_product_id: string, quantity: number }>>()
            combosRes.data?.forEach((c: any) => {
                if (!comboMap.has(c.parent_product_id)) {
                    comboMap.set(c.parent_product_id, [])
                }
                comboMap.get(c.parent_product_id)!.push({
                    child_product_id: c.child_product_id,
                    quantity: Number(c.quantity) || 1
                })
            })

            const wholesaleMap = new Map<string, number>()
            wholesaleRes.data?.forEach((wp: any) => {
                const current = wholesaleMap.get(wp.product_id) || Infinity
                const val = Number(wp.wholesale_price)
                if (!isNaN(val) && val < current) {
                    wholesaleMap.set(wp.product_id, val)
                }
            })

            return { comboComponentsMap: comboMap, bestWholesaleMap: wholesaleMap }
        }),
        withMemoryCache('profit_calc:price_reports_view_v2', PURCHASES_CACHE_TTL, async () => {
            // Query indexed `purchases` table directly in paginated batches instead of `inventory_price_reports_view`
            // (which times out after >8s once products exceed 1,000 rows)
            const vMap = new Map<string, number>()
            const BATCH_SIZE = 1000
            let page = 0

            while (page < 50) {
                const { data: puRows, error: puErr } = await supabase
                    .from('purchases')
                    .select('product_id, unit_amount, purchase_date, created_at')
                    .gt('unit_amount', 0)
                    .order('purchase_date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

                if (puErr) {
                    console.error('[OrderProfit] Error fetching purchases batch:', puErr)
                    break
                }
                if (!puRows || puRows.length === 0) break

                for (const pu of puRows) {
                    if (pu.product_id && !vMap.has(pu.product_id)) {
                        const price = Number(pu.unit_amount || 0)
                        if (price > 0) {
                            vMap.set(pu.product_id, price)
                        }
                    }
                }

                if (puRows.length < BATCH_SIZE) break
                page++
            }

            return vMap
        })
    ])

    const nowTime = Date.now()
    const { idToProductMap, skuToProductMap, nameToProductMap } = catalogMaps as any
    const { comboComponentsMap, bestWholesaleMap } = combosAndWholesale

    const matchedIdsSet = new Set<string>()
    productIdList.forEach(pid => {
        if (idToProductMap.has(pid)) matchedIdsSet.add(pid)
    })
    skuList.forEach(sku => {
        const prod = skuToProductMap.get(sku)
        if (prod) matchedIdsSet.add(prod.id)
    })
    const allMatchedIds = Array.from(matchedIdsSet)

    // B. Recursively collect all descendant child product IDs for combos/variations
    const allPriceQueryIds = new Set<string>(allMatchedIds)
    allMatchedIds.forEach(id => {
        if (comboComponentsMap.has(id)) {
            comboComponentsMap.get(id)!.forEach(comp => {
                allPriceQueryIds.add(comp.child_product_id)
                // Nested combo check
                if (comboComponentsMap.has(comp.child_product_id)) {
                    comboComponentsMap.get(comp.child_product_id)!.forEach(sub => {
                        allPriceQueryIds.add(sub.child_product_id)
                    })
                }
            })
        }
    })

    const queryIdList = Array.from(allPriceQueryIds)
    const latestPurchasesMap = new Map<string, number>()

    // Check which IDs still need fallback purchase lookup
    const missingIds: string[] = []
    queryIdList.forEach(id => {
        if (viewPurchasesMap.has(id)) return
        const cachedPu = cachedPurchasesMap.get(id)
        if (cachedPu && (nowTime - cachedPu.time < PURCHASES_CACHE_TTL)) {
            if (cachedPu.price > 0) {
                latestPurchasesMap.set(id, cachedPu.price)
            }
        } else {
            missingIds.push(id)
        }
    })

    if (missingIds.length > 0) {
        const CHUNK_SIZE = 100
        const idChunks: string[][] = []
        for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
            idChunks.push(missingIds.slice(i, i + CHUNK_SIZE))
        }

        const chunkResults = await Promise.all(
            idChunks.map(chunk =>
                supabase
                    .from('purchases')
                    .select('product_id, unit_amount, purchase_date')
                    .in('product_id', chunk)
                    .gt('unit_amount', 0)
                    .order('purchase_date', { ascending: false })
            )
        )

        for (const purchasesRes of chunkResults) {
            purchasesRes.data?.forEach((pu: any) => {
                if (!latestPurchasesMap.has(pu.product_id)) {
                    const price = Number(pu.unit_amount)
                    latestPurchasesMap.set(pu.product_id, price)
                    cachedPurchasesMap.set(pu.product_id, { price, time: nowTime })
                }
            })
        }

        // Also cache negative/zero results so missingIds doesn't re-query on every request
        missingIds.forEach(id => {
            if (!cachedPurchasesMap.has(id)) {
                cachedPurchasesMap.set(id, { price: 0, time: nowTime })
            }
        })
    }

    // Helper to resolve single item base price from view -> purchases -> wholesale -> product est_price
    function getSingleItemBasePrice(id: string, fallbackProd?: any): number {
        if (viewPurchasesMap.has(id)) return viewPurchasesMap.get(id)!
        if (latestPurchasesMap.has(id)) return latestPurchasesMap.get(id)!
        if (bestWholesaleMap.has(id)) return bestWholesaleMap.get(id)!
        if (fallbackProd && fallbackProd.est_price) {
            const est = Number(fallbackProd.est_price)
            if (!isNaN(est) && est > 0) return est
        }
        return 0
    }

    // Helper to resolve purchasing price of a product (supports combo/variation breakdown)
    function getPurchasingPrice(productId: string, product: any): number {
        if (!productId) return 0

        // Combo / variation resolution (identical to Average Sales Price)
        if (comboComponentsMap.has(productId)) {
            const components = comboComponentsMap.get(productId)!
            let comboSum = 0
            for (const comp of components) {
                let childPrice = 0
                if (comboComponentsMap.has(comp.child_product_id)) {
                    const subComps = comboComponentsMap.get(comp.child_product_id)!
                    childPrice = subComps.reduce((sum, sc) => sum + (getSingleItemBasePrice(sc.child_product_id) * sc.quantity), 0)
                } else {
                    childPrice = getSingleItemBasePrice(comp.child_product_id)
                }
                comboSum += childPrice * comp.quantity
            }
            if (comboSum > 0) return comboSum
        }

        // Single product resolution
        return getSingleItemBasePrice(productId, product)
    }

    // Pre-group order items by order_id in O(M) instead of O(N*M)
    const itemsByOrderId = new Map<string, any[]>()
    for (const item of allItems) {
        if (!itemsByOrderId.has(item.order_id)) {
            itemsByOrderId.set(item.order_id, [])
        }
        itemsByOrderId.get(item.order_id)!.push(item)
    }

    // 5. Calculate profit info for each order
    const enrichedOrders = orders.map(order => {
        const orderItems = itemsByOrderId.get(order.id) || []

        if (orderItems.length === 0) {
            const profitInfo: OrderProfitInfo = {
                status: 'invalid',
                profitAmount: null,
                receivableAmount: null,
                display: 'Invalid',
                tooltip: 'Order has no items.',
                items: []
            }
            return { ...order, profit_info: profitInfo }
        }

        let orderHasInvalid = false
        let orderHasMissingPurchasing = false
        let orderTotalProfit = 0
        let orderTotalReceivable = 0
        const itemDetails: ItemProfitDetail[] = []

        for (const item of orderItems) {
            const sku = (item.seller_sku || '').trim().toLowerCase()
            const itemNameKey = (item.product_name || '').trim().toLowerCase()
            const matchedProduct =
                skuToProductMap.get(sku) ||
                (item.product_id ? idToProductMap.get(item.product_id) : null) ||
                (itemNameKey ? nameToProductMap?.get(itemNameKey) : null)

            const rawName = (matchedProduct?.product_name || item.product_name || '').trim().toLowerCase()
            const isNameNotFound = !rawName || rawName === 'product not found' || rawName.startsWith('unknown product') || rawName.includes('product not found')

            // Condition 4: Product name is product not found or no product
            if (!matchedProduct || isNameNotFound) {
                orderHasInvalid = true
                itemDetails.push({
                    itemId: item.id,
                    sellerSku: item.seller_sku || 'N/A',
                    productName: item.product_name || 'Product Not Found',
                    productId: null,
                    quantity: item.quantity || 1,
                    unitAmount: Number(item.amount) || 0,
                    totalSales: (Number(item.amount) || 0) * (item.quantity || 1),
                    purchasingPrice: 0,
                    totalCost: 0,
                    commissionRate: null,
                    effectiveCommissionRate: null,
                    totalDeductions: 0,
                    netPayout: 0,
                    profit: null,
                    status: 'invalid',
                    invalidReason: 'Product not found in inventory'
                })
                continue
            }

            const purchPrice = getPurchasingPrice(matchedProduct.id, matchedProduct) || Number(item.purchase_cost || 0)
            const commRate = resolveCategoryCommission(matchedProduct, commissionMap)

            // Condition 3: No purchasing amount AND no commission
            if (purchPrice <= 0 && commRate === null) {
                orderHasInvalid = true
                itemDetails.push({
                    itemId: item.id,
                    sellerSku: item.seller_sku || 'N/A',
                    productName: matchedProduct.product_name,
                    productId: matchedProduct.id,
                    quantity: item.quantity || 1,
                    unitAmount: Number(item.amount) || 0,
                    totalSales: (Number(item.amount) || 0) * (item.quantity || 1),
                    purchasingPrice: 0,
                    totalCost: 0,
                    commissionRate: null,
                    effectiveCommissionRate: null,
                    totalDeductions: 0,
                    netPayout: 0,
                    profit: null,
                    status: 'invalid',
                    invalidReason: 'No purchasing price and no commission rate'
                })
                continue
            }

            // If no commission rate at all, cannot compute receivable or profit
            if (commRate === null) {
                orderHasInvalid = true
                itemDetails.push({
                    itemId: item.id,
                    sellerSku: item.seller_sku || 'N/A',
                    productName: matchedProduct.product_name,
                    productId: matchedProduct.id,
                    quantity: item.quantity || 1,
                    unitAmount: Number(item.amount) || 0,
                    totalSales: (Number(item.amount) || 0) * (item.quantity || 1),
                    purchasingPrice: purchPrice,
                    totalCost: purchPrice * (item.quantity || 1),
                    commissionRate: null,
                    effectiveCommissionRate: null,
                    totalDeductions: 0,
                    netPayout: 0,
                    profit: null,
                    status: 'invalid',
                    invalidReason: 'No commission rate found'
                })
                continue
            }

            // Calculation based on unit price and quantity:
            // "If product had more then two quantity then first check amount and multiply by qty"
            const qty = Number(item.quantity) || 1
            const unitAmount = Number(item.amount) || 0
            const totalItemSales = unitAmount * qty

            // Calculate unit deductions and payout using the exact Daraz fee engine
            const unitBreakdown = calculateDarazFeeBreakdown({
                salesPrice: unitAmount,
                categoryCommissionRate: commRate,
                otherFees
            })

            const lineNetPayout = parseFloat((unitBreakdown.netPayout * qty).toFixed(2))
            const lineDeductions = parseFloat((unitBreakdown.totalDeduction * qty).toFixed(2))
            orderTotalReceivable += lineNetPayout

            // Condition 2: No purchasing amount -> Show exact receivable amount (net payout after fees/commission)
            if (purchPrice <= 0) {
                orderHasMissingPurchasing = true
                itemDetails.push({
                    itemId: item.id,
                    sellerSku: item.seller_sku || 'N/A',
                    productName: matchedProduct.product_name,
                    productId: matchedProduct.id,
                    quantity: qty,
                    unitAmount,
                    totalSales: totalItemSales,
                    purchasingPrice: 0,
                    totalCost: 0,
                    commissionRate: commRate,
                    effectiveCommissionRate: unitBreakdown.effectiveCommissionRate,
                    totalDeductions: lineDeductions,
                    netPayout: lineNetPayout,
                    profit: null,
                    status: 'receivable'
                })
            } else {
                // Condition 1: Has purchasing and exact commission
                const unitProfit = unitBreakdown.netPayout - purchPrice
                const lineProfit = parseFloat((unitProfit * qty).toFixed(2))
                const lineCost = parseFloat((purchPrice * qty).toFixed(2))
                orderTotalProfit += lineProfit

                itemDetails.push({
                    itemId: item.id,
                    sellerSku: item.seller_sku || 'N/A',
                    productName: matchedProduct.product_name,
                    productId: matchedProduct.id,
                    quantity: qty,
                    unitAmount,
                    totalSales: totalItemSales,
                    purchasingPrice: purchPrice,
                    totalCost: lineCost,
                    commissionRate: commRate,
                    effectiveCommissionRate: unitBreakdown.effectiveCommissionRate,
                    totalDeductions: lineDeductions,
                    netPayout: lineNetPayout,
                    profit: lineProfit,
                    status: lineProfit >= 0 ? 'profit' : 'loss'
                })
            }
        }

        // Determine order-level status & display
        let finalStatus: OrderProfitInfo['status']
        let displayText: string
        let profitAmount: number | null = null
        let receivableAmount: number | null = null

        if (orderHasInvalid) {
            finalStatus = 'invalid'
            displayText = 'Invalid'
        } else if (orderHasMissingPurchasing) {
            finalStatus = 'receivable'
            receivableAmount = parseFloat(orderTotalReceivable.toFixed(1))
            displayText = `Rs. ${receivableAmount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
        } else {
            profitAmount = parseFloat(orderTotalProfit.toFixed(1))
            if (orderTotalProfit >= 0) {
                finalStatus = 'profit'
                displayText = `+Rs. ${profitAmount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
            } else {
                finalStatus = 'loss'
                displayText = `-Rs. ${Math.abs(profitAmount).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
            }
        }

        // Build comprehensive tooltip for hover view
        const tooltipLines: string[] = []
        const orderNum = order.order_number || order.order_id || 'N/A'
        const totalQty = order.total_quantity || orderItems.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)
        const grandTotal = order.grand_total || order.total_amount || orderItems.reduce((sum, i) => sum + ((Number(i.amount) || 0) * (Number(i.quantity) || 1)), 0)
        tooltipLines.push(`Order #${orderNum} | Qty: ${totalQty} | Amount: Rs. ${grandTotal?.toLocaleString()}`)
        tooltipLines.push(`Status: ${finalStatus.toUpperCase()} (${displayText})`)
        tooltipLines.push('----------------------------------------')

        itemDetails.forEach((detail, idx) => {
            if (itemDetails.length > 1) {
                tooltipLines.push(`Item ${idx + 1}: ${detail.productName}`)
            } else {
                tooltipLines.push(`Product: ${detail.productName}`)
            }
            tooltipLines.push(`• SKU: ${detail.sellerSku} | Qty: ${detail.quantity} @ Rs. ${detail.unitAmount} = Rs. ${detail.totalSales.toLocaleString()}`)

            if (detail.status === 'invalid') {
                tooltipLines.push(`• Error: ${detail.invalidReason || 'Invalid details'}`)
            } else {
                tooltipLines.push(`• Category Commission: ${detail.commissionRate?.toFixed(2)}% (+13% VAT = ${detail.effectiveCommissionRate?.toFixed(2)}%)`)
                tooltipLines.push(`• Total Daraz Deductions: -Rs. ${detail.totalDeductions.toFixed(2)}`)
                tooltipLines.push(`• Net Receivable: Rs. ${detail.netPayout.toFixed(2)}`)

                if (detail.purchasingPrice > 0) {
                    tooltipLines.push(`• Purchasing Cost: Rs. ${detail.purchasingPrice.toFixed(2)} x ${detail.quantity} = -Rs. ${detail.totalCost.toFixed(2)}`)
                    tooltipLines.push(`• Net Profit: ${detail.profit !== null && detail.profit >= 0 ? '+' : ''}Rs. ${detail.profit?.toFixed(2)}`)
                } else {
                    tooltipLines.push(`• Purchasing Cost: No Purchase Price Recorded`)
                }
            }

            if (idx < itemDetails.length - 1) {
                tooltipLines.push('- - - - - - - - - - - - - - - - - - - -')
            }
        })

        tooltipLines.push('----------------------------------------')
        if (finalStatus === 'profit') {
            tooltipLines.push(`Total Net Profit: ${displayText}`)
        } else if (finalStatus === 'loss') {
            tooltipLines.push(`Total Net Loss: ${displayText}`)
        } else if (finalStatus === 'receivable') {
            tooltipLines.push(`Total Net Receivable: ${displayText} (Purchasing Missing)`)
        } else {
            tooltipLines.push(`Action Required: Product details or purchasing price missing`)
        }

        const profitInfo: OrderProfitInfo = {
            status: finalStatus,
            profitAmount,
            receivableAmount,
            display: displayText,
            tooltip: tooltipLines.join('\n'),
            items: itemDetails
        }

        return {
            ...order,
            profit_info: profitInfo
        }
    })

    return enrichedOrders
}
