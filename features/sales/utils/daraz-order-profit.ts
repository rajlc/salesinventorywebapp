import { createAdminClient } from '@/lib/supabase/server'
import {
    calculateDarazFeeBreakdown,
    type OtherFeeItem
} from '@/features/sales/utils/daraz-fee-calculator'
import { getDarazOtherFees } from '@/features/sales/actions/daraz-commission-actions'

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
const COMMISSIONS_CACHE_TTL = 60 * 1000 // 1 minute (fast refresh)

let cachedOtherFees: OtherFeeItem[] | null = null
let cachedOtherFeesTime = 0
const OTHER_FEES_CACHE_TTL = 60 * 1000 // 1 minute

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

    // 2. Fetch category commissions and other fees concurrently
    const [commissionMap, otherFees] = await Promise.all([
        getCategoryCommissionMap(supabase),
        getCachedOtherFees()
    ])

    // 3. Fetch matching products from inventory
    // We search products where any of seller_sku 1-4 matches OR id in product IDs
    let matchedProducts: any[] = []
    if (skuList.length > 0 || productIdList.length > 0) {
        // Query products by ID
        const idPromise: Promise<any> = productIdList.length > 0
            ? Promise.resolve(
                supabase
                    .from('products')
                    .select('id, product_name, category_name, category_path, marketplace_category, seller_sku1, seller_sku2, seller_sku3, seller_sku4, commission_percent, est_price')
                    .in('id', productIdList)
                    .eq('is_deleted', false)
            )
            : Promise.resolve({ data: [] })

        // Query products by SKU matching
        const skuPromises: Promise<any>[] = []
        const BATCH = 20
        for (let i = 0; i < skuList.length; i += BATCH) {
            const batch = skuList.slice(i, i + BATCH)
            const orConditions = batch
                .map(s => {
                    const clean = s.replace(/"/g, '')
                    return `seller_sku1.eq."${clean}",seller_sku2.eq."${clean}",seller_sku3.eq."${clean}",seller_sku4.eq."${clean}"`
                })
                .join(',')

            skuPromises.push(
                Promise.resolve(
                    supabase
                        .from('products')
                        .select('id, product_name, category_name, category_path, marketplace_category, seller_sku1, seller_sku2, seller_sku3, seller_sku4, commission_percent, est_price')
                        .or(orConditions)
                        .eq('is_deleted', false)
                )
            )
        }

        const [idRes, ...skuResults] = await Promise.all([idPromise, ...skuPromises])
        const productMapById = new Map<string, any>()

        if (idRes.data) {
            idRes.data.forEach((p: any) => productMapById.set(p.id, p))
        }
        for (const res of skuResults) {
            if (res.data) {
                res.data.forEach((p: any) => productMapById.set(p.id, p))
            }
        }
        matchedProducts = Array.from(productMapById.values())
    }

    // Build fast lookup maps
    const skuToProductMap = new Map<string, any>()
    const idToProductMap = new Map<string, any>()

    matchedProducts.forEach(p => {
        idToProductMap.set(p.id, p);
        [p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4].forEach(sku => {
            if (sku) {
                skuToProductMap.set(String(sku).trim().toLowerCase(), p)
            }
        })
    })

    // 4. Fetch purchasing prices, combos, and variations
    const allMatchedIds = matchedProducts.map(p => p.id)

    // A. Fetch combos and wholesale prices
    const [combosRes, wholesaleRes] = await Promise.all([
        supabase
            .from('product_combos')
            .select('parent_product_id, child_product_id, quantity'),
        supabase
            .from('product_wholesale_prices')
            .select('product_id, wholesale_price')
    ])

    const comboComponentsMap = new Map<string, Array<{ child_product_id: string, quantity: number }>>()
    combosRes.data?.forEach((c: any) => {
        if (!comboComponentsMap.has(c.parent_product_id)) {
            comboComponentsMap.set(c.parent_product_id, [])
        }
        comboComponentsMap.get(c.parent_product_id)!.push({
            child_product_id: c.child_product_id,
            quantity: Number(c.quantity) || 1
        })
    })

    const bestWholesaleMap = new Map<string, number>()
    wholesaleRes.data?.forEach((wp: any) => {
        const current = bestWholesaleMap.get(wp.product_id) || Infinity
        const val = Number(wp.wholesale_price)
        if (!isNaN(val) && val < current) {
            bestWholesaleMap.set(wp.product_id, val)
        }
    })

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
    const viewPurchasesMap = new Map<string, number>()

    if (queryIdList.length > 0) {
        const [viewRes, purchasesRes] = await Promise.all([
            // Latest prices from inventory_price_reports_view (matches Average Sales Price page)
            supabase
                .from('inventory_price_reports_view')
                .select('product_id, last_price, est_price')
                .in('product_id', queryIdList),
            // Direct purchase history
            supabase
                .from('purchases')
                .select('product_id, unit_amount, purchase_date')
                .in('product_id', queryIdList)
                .gt('unit_amount', 0)
                .order('purchase_date', { ascending: false })
        ])

        viewRes.data?.forEach((vp: any) => {
            const price = Number(vp.last_price || vp.est_price || 0)
            if (price > 0) {
                viewPurchasesMap.set(vp.product_id, price)
            }
        })

        purchasesRes.data?.forEach((pu: any) => {
            if (!latestPurchasesMap.has(pu.product_id)) {
                latestPurchasesMap.set(pu.product_id, Number(pu.unit_amount))
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

    // 5. Calculate profit info for each order
    const enrichedOrders = orders.map(order => {
        const orderItems = allItems.filter(i => i.order_id === order.id)

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
            const matchedProduct = skuToProductMap.get(sku) || (item.product_id ? idToProductMap.get(item.product_id) : null)

            const rawName = (item.product_name || matchedProduct?.product_name || '').trim().toLowerCase()
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

            const purchPrice = getPurchasingPrice(matchedProduct.id, matchedProduct)
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
