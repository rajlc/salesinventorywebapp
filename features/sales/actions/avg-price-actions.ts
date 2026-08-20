'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath, unstable_cache } from 'next/cache'
import { getGoogleSheetsClient } from '@/lib/google-sheets'
import axios from 'axios'
import crypto from 'crypto'
import { createClient as createJSClient } from '@supabase/supabase-js'

const STORE_NAME_MAP: Record<string, string> = {
    'lamichhaneram100@gmail.com': 'Balaju',
    'shop.bagmati@gmail.com': 'BTAS',
    'Bagmationline8@gmail.com': 'Bagmati',
    'supplierslamichhane9@gmail.com': 'Cosmetics'
}

export interface LivePriceDetail {
    price: number
    special_price: number | null
    store_name: string
    quantity: number
    store_id: string
    status?: string | null
}

import { CompetitorItem, getCompetitorDataForProducts } from './competitor-actions'

export interface DarazAvgPriceItem {
    product_id: string
    product_name: string
    image_url: string | null
    seller_skus: string[]
    seller_sku1: string | null
    seller_sku2: string | null
    seller_sku3: string | null
    seller_sku4: string | null
    seller_accounts: string[]
    purchasing_price: number // Priority: Last Price -> Est Price -> Wholesale -> 0
    purchasing_remark: string | null
    commission_percent: number | null // Daraz fee % based on delivered orders
    is_default_commission: boolean
    breakeven_price: number // purchasing_price / (1 - commission_percent)
    regular_sales_price: number // breakeven_price * 1.15
    market_price: number | null
    market_price_profit: number | null // market_price - (market_price * commission) - purchasing_price
    campaign_price: number | null
    campaign_price_profit: number | null
    updated_at: string | null
    live_prices?: Record<string, LivePriceDetail>
    website_regular_price?: number | null
    website_special_price?: number | null
    mrp_price?: number | null
    sold_qty?: number
    sold_qty_by_account?: Record<string, number>
    seller_account1?: string | null
    seller_account2?: string | null
    seller_account3?: string | null
    seller_account4?: string | null
    sales_priority?: boolean
    priority_seller_account?: string | null
    is_price_locked?: boolean
    is_new_pushed?: boolean
    pushed_at?: string | null
    competitors?: CompetitorItem[]
    weekly_competitor_sold?: number
    has_price_alert?: boolean
}

async function getSoldQuantitiesMap(days: number) {
    const supabase = await createClient()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const FETCH_SIZE = 1000
    const NON_SOLD_STATUSES = [
        'Returned Delivered', 'returned delivered',
        'Customer Return Delivered', 'customer return delivered',
        'Cancelled', 'cancelled', 'Cancel', 'cancel',
        'unpaid', 'Unpaid',
    ]

    // 1. Get the total count first using a light head query
    const { count, error: countError } = await supabase
        .from('daraz_order_items')
        .select('product_id, daraz_orders!inner(order_date)', { count: 'exact', head: true })
        .not('product_id', 'is', null)
        .gte('daraz_orders.order_date', startDateStr)

    if (countError || count === null || count === 0) {
        if (countError) console.error('[getSoldQuantitiesMap] count error:', countError)
        return new Map<string, { total: number; accounts: Record<string, number> }>()
    }

    // 2. Fetch pages concurrently
    const totalPages = Math.ceil(count / FETCH_SIZE)
    const pageQueries = []
    for (let page = 0; page < totalPages; page++) {
        const from = page * FETCH_SIZE
        const to = from + FETCH_SIZE - 1
        pageQueries.push(
            supabase
                .from('daraz_order_items')
                .select(`
                    product_id,
                    quantity,
                    item_status,
                    seller_account,
                    daraz_orders!inner(
                        order_date,
                        order_status,
                        deleted
                    )
                `)
                .not('product_id', 'is', null)
                .gte('daraz_orders.order_date', startDateStr)
                .range(from, to)
        )
    }

    const pageResults = await Promise.all(pageQueries)
    let rawItems: any[] = []
    for (const res of pageResults) {
        if (res.error) {
            console.error('[getSoldQuantitiesMap] fetch page error:', res.error)
            continue
        }
        if (res.data) {
            rawItems = rawItems.concat(res.data)
        }
    }

    const soldQtyMap = new Map<string, { total: number; accounts: Record<string, number> }>()
    rawItems.forEach((item: any) => {
        if (item.daraz_orders?.deleted) return

        const status = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
        const isNonSold = NON_SOLD_STATUSES.some(s => s.toLowerCase() === status)
        if (isNonSold) return

        const qty = item.quantity || 1
        const pid = item.product_id
        const sellerAccount = item.seller_account || 'Unknown'
        if (pid) {
            if (!soldQtyMap.has(pid)) {
                soldQtyMap.set(pid, { total: 0, accounts: {} })
            }
            const entry = soldQtyMap.get(pid)!
            entry.total += qty
            entry.accounts[sellerAccount] = (entry.accounts[sellerAccount] || 0) + qty
        }
    })

    return soldQtyMap
}

async function fetchAllRows(
    client: any,
    table: string,
    selectQuery: string = '*',
    orderOptions?: { column: string; ascending?: boolean }[]
) {
    const BATCH_SIZE = 1000
    try {
        const { count, error: countErr } = await client
            .from(table)
            .select(selectQuery, { count: 'exact', head: true })

        if (countErr || count === null || count === 0) {
            const { data } = await client.from(table).select(selectQuery)
            return data || []
        }

        const totalPages = Math.ceil(count / BATCH_SIZE)
        if (totalPages <= 1) {
            let q = client.from(table).select(selectQuery)
            if (orderOptions) {
                orderOptions.forEach(o => {
                    q = q.order(o.column, { ascending: o.ascending ?? true })
                })
            }
            const { data } = await q
            return data || []
        }

        const pagePromises = []
        for (let page = 0; page < totalPages; page++) {
            let q = client.from(table).select(selectQuery)
            if (orderOptions) {
                orderOptions.forEach(o => {
                    q = q.order(o.column, { ascending: o.ascending ?? true })
                })
            }
            pagePromises.push(
                q.range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)
            )
        }

        const pageResults = await Promise.all(pagePromises)
        const allData: any[] = []
        for (const res of pageResults) {
            if (res.data) {
                allData.push(...res.data)
            }
        }
        return allData
    } catch (err) {
        console.error(`fetchAllRows error for table ${table}:`, err)
        const { data } = await client.from(table).select(selectQuery)
        return data || []
    }
}

// Cache key varies by `days` param. TTL = 90 seconds.
// This prevents the 8-parallel full-table-scan storm from firing on every page render.
const _getDarazAvgPricesCached = unstable_cache(
    async (days: number | string) => _getDarazAvgPricesInner(days),
    ['daraz-avg-prices'],
    { revalidate: 90 }
)

export async function getDarazAvgPrices(days: number | string = 60) {
    return _getDarazAvgPricesCached(days)
}

async function _getDarazAvgPricesInner(days: number | string = 60) {
    const supabase = await createClient()

    const daysNum = typeof days === 'number' ? days : 60
    // 1. Fetch soldQtyMap concurrently
    const soldQtyMapPromise = getSoldQuantitiesMap(daysNum)

    // 2. Fetch inventory products from the reports view concurrently (PAGINATED FOR ALL 1000+ PRODUCTS)
    const productsPromise = fetchAllRows(supabase, 'inventory_price_reports_view', '*')

    // 3. Fetch MRP prices concurrently (PAGINATED)
    const mrpPricesPromise = fetchAllRows(supabase, 'mrp_prices', 'inventory_id, product_name, mrp_price', [
        { column: 'applied_date', ascending: false },
        { column: 'created_at', ascending: false }
    ])

    // 4. Fetch products SKUs, priorities, lock flags, push flags concurrently (PAGINATED)
    const skusPromise = fetchAllRows(supabase, 'products', 'id, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4, sales_priority, priority_seller_account, commission_percent, is_price_locked, is_new_pushed, pushed_at')

    // 5. Fetch combos concurrently (PAGINATED)
    const combosPromise = fetchAllRows(supabase, 'product_combos', 'parent_product_id, child_product_id, quantity')

    // 6. Fetch wholesale prices concurrently (PAGINATED)
    const wholesalePricesPromise = fetchAllRows(supabase, 'product_wholesale_prices', 'product_id, wholesale_price')

    // 7. Fetch daraz average prices (editable fields) concurrently (PAGINATED)
    const dbPricesPromise = fetchAllRows(supabase, 'daraz_avg_prices', '*')

    // 8. Fetch Website Prices from Ecommerce DB concurrently (PAGINATED)
    const ecommerceSupabaseUrl = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL
    const ecommerceSupabaseKey = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_ANON_KEY
    let ecommercePromise: Promise<any[]> = Promise.resolve([])
    if (ecommerceSupabaseUrl && ecommerceSupabaseKey) {
        try {
            const ecommerceSupabase = createJSClient(ecommerceSupabaseUrl, ecommerceSupabaseKey)
            ecommercePromise = fetchAllRows(ecommerceSupabase, 'ecommerce_products', 'inventory_id, regular_price, special_price')
        } catch (err) {
            console.error('Failed to init ecommerce client:', err)
        }
    }

    // 9. Fetch Live Prices count concurrently for pagination count
    const liveCountPromise = supabase
        .from('daraz_live_prices')
        .select('*', { count: 'exact', head: true })

    // Await all independent calls concurrently!
    const [
        soldQtyMap,
        productsData,
        mrpPricesData,
        skusData,
        combosData,
        wholesalePricesData,
        dbPrices,
        webProducts,
        liveCountRes
    ] = await Promise.all([
        soldQtyMapPromise,
        productsPromise,
        mrpPricesPromise,
        skusPromise,
        combosPromise,
        wholesalePricesPromise,
        dbPricesPromise,
        ecommercePromise,
        liveCountPromise
    ])

    // Parallel fetch live prices page-by-page concurrently!
    const allDbLivePrices: any[] = []
    const livePricesCount = liveCountRes.count
    const liveCountError = liveCountRes.error
    if (!liveCountError && livePricesCount !== null && livePricesCount > 0) {
        const totalLivePages = Math.ceil(livePricesCount / 1000)
        const livePromises = []
        for (let page = 0; page < totalLivePages; page++) {
            livePromises.push(
                supabase
                    .from('daraz_live_prices')
                    .select('*')
                    .range(page * 1000, (page + 1) * 1000 - 1)
            )
        }
        const liveResults = await Promise.all(livePromises)
        for (const res of liveResults) {
            if (res.error) {
                console.error('daraz_live_prices fetch page error:', res.error.message)
                continue
            }
            if (res.data) {
                allDbLivePrices.push(...res.data)
            }
        }
    }

    const mrpMapById = new Map<string, number>()
    const mrpMapByName = new Map<string, number>()

    if (mrpPricesData) {
        mrpPricesData.forEach((item: any) => {
            if (item.inventory_id && !mrpMapById.has(item.inventory_id)) {
                mrpMapById.set(item.inventory_id, Number(item.mrp_price))
            }
            const nameKey = item.product_name?.toLowerCase().trim()
            if (nameKey && !mrpMapByName.has(nameKey)) {
                mrpMapByName.set(nameKey, Number(item.mrp_price))
            }
        })
    }

    const skuMap = new Map<string, any>()
    const reverseSkuMap = new Map<string, string>() // Map SKU to Product ID

    if (skusData) {
        skusData.forEach((s: any) => {
            skuMap.set(s.id, s)
            if (s.seller_sku1) reverseSkuMap.set(s.seller_sku1.toLowerCase().trim(), s.id)
            if (s.seller_sku2) reverseSkuMap.set(s.seller_sku2.toLowerCase().trim(), s.id)
            if (s.seller_sku3) reverseSkuMap.set(s.seller_sku3.toLowerCase().trim(), s.id)
            if (s.seller_sku4) reverseSkuMap.set(s.seller_sku4.toLowerCase().trim(), s.id)
        })
    }

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

    const bestWholesaleMap = new Map<string, number>()
    wholesalePricesData?.forEach((wp: any) => {
        const currentMin = bestWholesaleMap.get(wp.product_id) || Infinity
        if (wp.wholesale_price < currentMin) {
            bestWholesaleMap.set(wp.product_id, Number(wp.wholesale_price))
        }
    })

    const basePricesMap: Record<string, { price: number, remark: string | null }> = {}
    productsData?.forEach((p: any) => {
        let price = p.last_price || p.est_price || 0
        let remark: string | null = null

        if (price === 0 && bestWholesaleMap.has(p.product_id)) {
            price = bestWholesaleMap.get(p.product_id)!
            remark = '(Est Price)'
        }

        basePricesMap[p.product_id] = { price, remark }
    })

    const calculatedComboPrices: Record<string, { price: number, remark: string | null }> = {}
    Object.keys(comboComponentsMap).forEach(parentId => {
        const components = comboComponentsMap[parentId]
        let hasWholesaleFallback = false
        const parentPrice = components.reduce((sum, comp) => {
            const childData = basePricesMap[comp.child_product_id] || { price: 0, remark: null }
            if (childData.remark === '(Est Price)') hasWholesaleFallback = true
            return sum + (childData.price * comp.quantity)
        }, 0)
        calculatedComboPrices[parentId] = {
            price: parentPrice,
            remark: hasWholesaleFallback ? '(Est Price)' : null
        }
    })

    const pricesMap = new Map<string, any>()
    if (dbPrices) {
        dbPrices.forEach((p: any) => pricesMap.set(p.product_id, p))
    }

    const livePricesMap = new Map<string, any[]>()
    if (allDbLivePrices.length > 0) {
        allDbLivePrices.forEach((lp: any) => {
            const sku = lp.seller_sku.toLowerCase().trim()
            if (!livePricesMap.has(sku)) {
                livePricesMap.set(sku, [])
            }
            livePricesMap.get(sku)!.push(lp)
        })
    }

    const websitePricesMap = new Map<string, { regular_price: number | null, special_price: number | null }>()
    if (webProducts) {
        webProducts.forEach((wp: any) => {
            if (wp.inventory_id) {
                websitePricesMap.set(wp.inventory_id, {
                    regular_price: wp.regular_price ? Number(wp.regular_price) : null,
                    special_price: wp.special_price ? Number(wp.special_price) : null
                })
            }
        })
    }

    // 4. Combine all data
    const productIds = (productsData || []).map((p: any) => p.product_id).filter(Boolean)
    const competitorMap = await getCompetitorDataForProducts(productIds)

    const result: DarazAvgPriceItem[] = (productsData || []).map((p: any) => {
        const prodSkus = skuMap.get(p.product_id) || {}
        const skus = [prodSkus.seller_sku1, prodSkus.seller_sku2, prodSkus.seller_sku3, prodSkus.seller_sku4].filter(Boolean)
        const sellerAccounts = [prodSkus.seller_account1, prodSkus.seller_account2, prodSkus.seller_account3, prodSkus.seller_account4].filter(Boolean)

        const comboData = calculatedComboPrices[p.product_id]
        const baseData = basePricesMap[p.product_id] || { price: 0, remark: null }

        const isCombo = !!comboData
        const purchasingPrice = isCombo ? comboData.price : baseData.price
        const purchasingRemark = isCombo ? comboData.remark : baseData.remark

        // Latest Commission Percent
        // Load directly from products table if available, fallback to 25%
        const dbComm = prodSkus.commission_percent
        let commissionPercent = 0.25
        let isDefaultCommission = true

        if (dbComm !== undefined && dbComm !== null) {
            commissionPercent = dbComm / 100
            if (dbComm !== 25.00) {
                isDefaultCommission = false
            }
        }

        // Calculations
        let breakevenPrice = 0
        if (commissionPercent !== null && commissionPercent < 1) {
            breakevenPrice = purchasingPrice / (1 - commissionPercent)
        } else {
            breakevenPrice = purchasingPrice // fallback if no commission data
        }

        const rawRegularSalesPrice = breakevenPrice * 1.15
        const regularSalesPrice = Math.ceil(rawRegularSalesPrice / 5) * 5

        const editableStats = pricesMap.get(p.product_id)
        const marketPrice = editableStats?.market_price || null
        const campaignPrice = editableStats?.campaign_price || null

        const marketPriceProfit = marketPrice ? (marketPrice - (marketPrice * commissionPercent) - purchasingPrice) : null
        const campaignPriceProfit = campaignPrice ? (campaignPrice - (campaignPrice * commissionPercent) - purchasingPrice) : null

        // Live Prices Mapping across 4 slots
        const productLivePrices: Record<string, LivePriceDetail> = {}
        const rawSkus = [prodSkus.seller_sku1, prodSkus.seller_sku2, prodSkus.seller_sku3, prodSkus.seller_sku4]
        const rawAccounts = [prodSkus.seller_account1, prodSkus.seller_account2, prodSkus.seller_account3, prodSkus.seller_account4]

        rawSkus.forEach((sku, idx) => {
            if (!sku) return
            const lowerSku = String(sku).toLowerCase().trim()
            const prices = livePricesMap.get(lowerSku)
            const targetAccount = rawAccounts[idx] ? String(rawAccounts[idx]).toLowerCase().trim() : null

            if (prices && prices.length > 0) {
                // 1. Try to find store matching targetAccount for this slot
                let sp = targetAccount 
                    ? prices.find(p => p.store_name?.toLowerCase().includes(targetAccount) || p.account?.toLowerCase().includes(targetAccount))
                    : null
                
                // 2. Fallback to prices[idx] if available, else prices[0]
                if (!sp) {
                    sp = prices[idx] || prices[0]
                }

                const statusStr = (sp.status || '').toLowerCase().trim()
                const isInactive = statusStr === 'inactive' || statusStr === 'deleted' || statusStr === 'suspended' || statusStr === 'deactivated'

                if (!isInactive) {
                    const detail: LivePriceDetail = {
                        price: Number(sp.price || 0),
                        special_price: sp.special_price ? Number(sp.special_price) : null,
                        store_name: String(sp.store_name || 'Unknown'),
                        quantity: Number(sp.quantity || 0),
                        store_id: String(sp.store_id || ''),
                        status: sp.status || 'active'
                    }

                    // Key by slot index (sku_slot_N) and by raw SKU name
                    productLivePrices[`${sku}_slot_${idx}`] = detail
                    if (!productLivePrices[sku]) {
                        productLivePrices[sku] = detail
                    }
                }
            }
        })

        const websitePrices = websitePricesMap.get(p.product_id) || { regular_price: null, special_price: null }

        const mrpPrice = (p.product_id && mrpMapById.has(p.product_id))
            ? mrpMapById.get(p.product_id)
            : (p.product_name ? mrpMapByName.get(p.product_name.toLowerCase().trim()) : null)

        const salesEntry = soldQtyMap.get(p.product_id)
        const productCompetitors = competitorMap[p.product_id] || []
        const weeklyCompetitorSold = productCompetitors.reduce((sum, c) => sum + (c.sold_7d || 0), 0)
        const hasPriceAlert = productCompetitors.some(c => c.is_price_updated_7d)

        return {
            product_id: p.product_id,
            product_name: p.product_name,
            image_url: p.image_url,
            seller_skus: skus,
            seller_sku1: prodSkus.seller_sku1 || null,
            seller_sku2: prodSkus.seller_sku2 || null,
            seller_sku3: prodSkus.seller_sku3 || null,
            seller_sku4: prodSkus.seller_sku4 || null,
            seller_account1: prodSkus.seller_account1 || null,
            seller_account2: prodSkus.seller_account2 || null,
            seller_account3: prodSkus.seller_account3 || null,
            seller_account4: prodSkus.seller_account4 || null,
            seller_accounts: sellerAccounts,
            purchasing_price: purchasingPrice,
            purchasing_remark: purchasingRemark,
            commission_percent: commissionPercent !== null ? commissionPercent * 100 : null, // Convert to percentage 15%
            is_default_commission: isDefaultCommission,
            breakeven_price: breakevenPrice,
            regular_sales_price: regularSalesPrice,
            market_price: marketPrice,
            market_price_profit: marketPriceProfit,
            campaign_price: campaignPrice,
            campaign_price_profit: campaignPriceProfit,
            updated_at: editableStats?.updated_at || null,
            live_prices: productLivePrices,
            website_regular_price: websitePrices.regular_price,
            website_special_price: websitePrices.special_price,
            mrp_price: mrpPrice || null,
            sold_qty: salesEntry ? salesEntry.total : 0,
            sold_qty_by_account: salesEntry ? salesEntry.accounts : {},
            sales_priority: prodSkus.sales_priority || false,
            priority_seller_account: prodSkus.priority_seller_account || null,
            is_price_locked: prodSkus?.is_price_locked || false,
            is_new_pushed: prodSkus?.is_new_pushed || false,
            pushed_at: prodSkus?.pushed_at || null,
            competitors: productCompetitors,
            weekly_competitor_sold: weeklyCompetitorSold,
            has_price_alert: hasPriceAlert
        }
    })

    // Sort by sold_qty descending, or by is_new_pushed desc if selected option is 'new_listed'
    if (days === 'new_listed') {
        result.sort((a, b) => {
            if (a.is_new_pushed && !b.is_new_pushed) return -1
            if (!a.is_new_pushed && b.is_new_pushed) return 1
            if (a.is_new_pushed && b.is_new_pushed) {
                const timeA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0
                const timeB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0
                if (timeA !== timeB) return timeB - timeA
            }
            return (b.sold_qty || 0) - (a.sold_qty || 0)
        })
    } else {
        result.sort((a, b) => (b.sold_qty || 0) - (a.sold_qty || 0))
    }

    return result
}

export async function updateDarazAvgPrice(productId: string, data: { market_price?: number | null, campaign_price?: number | null }) {
    const supabase = await createClient()

    // Assuming daraz_avg_prices exists. If not, this triggers an error you'll know to run the SQL migration.
    // Try to update first, if it fails, maybe insert
    const { data: existing, error: fetchErr } = await supabase
        .from('daraz_avg_prices')
        .select('product_id')
        .eq('product_id', productId)
        .maybeSingle()

    if (fetchErr) {
        throw new Error('Database error. Did you run the SQL migration?')
    }

    if (existing) {
        const { error } = await supabase
            .from('daraz_avg_prices')
            .update(data)
            .eq('product_id', productId)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from('daraz_avg_prices')
            .insert([{ product_id: productId, ...data }])
        if (error) throw new Error(error.message)
    }

    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true }
}

export async function bulkUpdateDarazAvgPrice(updates: { product_id: string, market_price?: number | null, campaign_price?: number | null }[]) {
    const supabase = await createClient()

    if (!updates || updates.length === 0) return { success: true }

    // Single upsert replaces N×2 (SELECT + UPDATE/INSERT) loop.
    // Requires unique index on daraz_avg_prices(product_id) — see migration 20260820_add_missing_indexes.sql
    const rows = updates.map(update => {
        const row: any = { product_id: update.product_id }
        if (update.market_price !== undefined) row.market_price = update.market_price
        if (update.campaign_price !== undefined) row.campaign_price = update.campaign_price
        return row
    })

    // Process in batches of 500 to stay within Supabase request size limits
    const BATCH_SIZE = 500
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
            .from('daraz_avg_prices')
            .upsert(batch, { onConflict: 'product_id', ignoreDuplicates: false })
        if (error) {
            console.error('[bulkUpdateDarazAvgPrice] Upsert error:', error.message)
            throw new Error(error.message)
        }
    }

    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true }
}

const SHEET_ID = '1ztKJH0rrE1Od2lXJA2f8AoQ_FQ3fmnpqQietx2ZulZE'
const RANGE = 'Daraz Avg Price!A:N'

export async function syncDarazAvgPricesGoogleSheets() {
    try {
        const sheets = await getGoogleSheetsClient()
        const appData = await getDarazAvgPrices()

        // 1. Read Google Sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE,
        }).catch((err: any) => {
            console.error('Failed to read Sheet. Does it exist?', err.message)
            return null
        })

        const rows = response?.data?.values || []
        const headerRow = rows[0] || []
        const sheetDataMap = new Map<string, any>()

        // 2. Parse Sheet Data (we assume S.N, Product Name, SKUs, Purchasing, Commission, Breakeven, Regular, Market, Market Profit, Campaign)
        // Let's enforce reading by Product ID to safely sync back. We must place Product ID in a hidden or explicit column.
        // We will store Product ID in Column K or just Column A implicitly if we rewrite entirely.
        // Since the user wants two-way sync, let's write Product ID to the last column.

        // Actually, simplest way for Two-Way sync on entirely derived data where only Market and Campaign are editable:
        // - App -> Sheet: Overwrite entirely but keep Market/Campaign.
        // - Sheet -> App: Read Market/Campaign from Sheet matched by Product ID and update DB, THEN overwrite Sheet again with latest everything.
        // If Sheet has a different Market Price, we read it before overwriting.

        if (rows.length > 1) {
            // Find columns
            const idColIdx = headerRow.findIndex((h: string) => h === 'Product ID (DO NOT EDIT)')
            const marketColIdx = headerRow.findIndex((h: string) => h === 'Market Price')
            const campaignColIdx = headerRow.findIndex((h: string) => h === 'Campaign Price')

            if (idColIdx !== -1 && marketColIdx !== -1 && campaignColIdx !== -1) {
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i]
                    const productId = row[idColIdx]
                    const marketStr = row[marketColIdx]
                    const campaignStr = row[campaignColIdx]

                    if (productId) {
                        const marketVal = marketStr ? parseFloat(marketStr.replace(/[^0-9.]/g, '')) : null
                        const campaignVal = campaignStr ? parseFloat(campaignStr.replace(/[^0-9.]/g, '')) : null

                        sheetDataMap.set(productId, {
                            market_price: isNaN(marketVal as any) ? null : marketVal,
                            campaign_price: isNaN(campaignVal as any) ? null : campaignVal
                        })
                    }
                }
            }
        }

        // 3. Update DB with Sheet Data (Sheet -> App)
        const SYNC_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes priority for Webapp
        const now = Date.now()

        for (const item of appData) {
            const sheetItem = sheetDataMap.get(item.product_id)
            if (sheetItem) {
                // Heuristic: If we recently updated in the Webapp (within 5 mins), ignore the Sheet for now.
                // This ensures Webapp has priority for fresh changes.
                const lastUpdated = item.updated_at ? new Date(item.updated_at).getTime() : 0
                const isRecentlyUpdatedInApp = (now - lastUpdated) < SYNC_COOLDOWN_MS

                if (isRecentlyUpdatedInApp) {
                    // console.log(`[SYNC] Priority: Webapp (recently changed) for ${item.product_name}`)
                    continue
                }

                const updatedFields: any = {}
                if (sheetItem.market_price !== null && sheetItem.market_price !== item.market_price) {
                    updatedFields.market_price = sheetItem.market_price
                    item.market_price = sheetItem.market_price
                }
                if (sheetItem.campaign_price !== null && sheetItem.campaign_price !== item.campaign_price) {
                    updatedFields.campaign_price = sheetItem.campaign_price
                    item.campaign_price = sheetItem.campaign_price
                }

                if (Object.keys(updatedFields).length > 0) {
                    await updateDarazAvgPrice(item.product_id, updatedFields)
                }
            }
        }

        // 4. Overwrite Sheet with latest combined data (App -> Sheet)
        const headers = [
            'S.N', 'Product Name', 'Seller SKU 1', 'Seller SKU 2', 'Seller SKU 3', 'Seller SKU 4',
            'Purchasing Price', 'Commission (%)', 'Breakeven Price', 'Regular Sales Price',
            'Market Price', 'Market Price Profit', 'Campaign Price', 'Product ID (DO NOT EDIT)'
        ]

        const writeValues = [headers]
        appData.forEach((item, index) => {
            writeValues.push([
                String(index + 1),
                item.product_name || '',
                item.seller_sku1 || '',
                item.seller_sku2 || '',
                item.seller_sku3 || '',
                item.seller_sku4 || '',
                item.purchasing_price.toFixed(2),
                (item.commission_percent !== null ? item.commission_percent : 25).toFixed(2) + '%',
                item.breakeven_price.toFixed(2),
                item.regular_sales_price.toFixed(2),
                item.market_price !== null ? String(item.market_price) : '',
                item.market_price !== null ? (item.market_price - item.breakeven_price).toFixed(2) : '',
                item.campaign_price !== null ? String(item.campaign_price) : '',
                item.product_id
            ])
        })

        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: 'Daraz Avg Price!A1:N' + writeValues.length,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: writeValues
            }
        })

        // Clear any leftover rows below
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `Daraz Avg Price!A${writeValues.length + 1}:N1000` // Clear up to row 1000
        }).catch(() => { })

        revalidatePath('/dashboard/sales/daraz/average-sales-price')

        return { success: true, message: 'Synced successfully with Google Sheets' }

    } catch (error: any) {
        console.error('Sync Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during sync' }
    }
}

export async function pullDarazAvgPricesFromGoogleSheets() {
    try {
        const sheets = await getGoogleSheetsClient()
        const appData = await getDarazAvgPrices()

        // 1. Read Google Sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE,
        })

        const rows = response?.data?.values || []
        const headerRow = rows[0] || []
        const sheetDataMap = new Map<string, any>()

        if (rows.length > 1) {
            const idColIdx = headerRow.findIndex((h: string) => h === 'Product ID (DO NOT EDIT)')
            const marketColIdx = headerRow.findIndex((h: string) => h === 'Market Price')
            const campaignColIdx = headerRow.findIndex((h: string) => h === 'Campaign Price')

            if (idColIdx !== -1 && marketColIdx !== -1 && campaignColIdx !== -1) {
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i]
                    const productId = row[idColIdx]
                    const marketStr = row[marketColIdx]
                    const campaignStr = row[campaignColIdx]

                    if (productId) {
                        const marketVal = marketStr ? parseFloat(marketStr.replace(/[^0-9.]/g, '')) : null
                        const campaignVal = campaignStr ? parseFloat(campaignStr.replace(/[^0-9.]/g, '')) : null

                        sheetDataMap.set(productId, {
                            market_price: isNaN(marketVal as any) ? null : marketVal,
                            campaign_price: isNaN(campaignVal as any) ? null : campaignVal
                        })
                    }
                }
            }
        }

        // 2. Update DB with Sheet Data (FORCE Pull)
        for (const item of appData) {
            const sheetItem = sheetDataMap.get(item.product_id)
            if (sheetItem) {
                const updatedFields: any = {}
                if (sheetItem.market_price !== null && sheetItem.market_price !== item.market_price) {
                    updatedFields.market_price = sheetItem.market_price
                }
                if (sheetItem.campaign_price !== null && sheetItem.campaign_price !== item.campaign_price) {
                    updatedFields.campaign_price = sheetItem.campaign_price
                }

                if (Object.keys(updatedFields).length > 0) {
                    await updateDarazAvgPrice(item.product_id, updatedFields)
                }
            }
        }

        revalidatePath('/dashboard/sales/daraz/average-sales-price')
        return { success: true, message: 'Data pulled successfully from Google Sheets' }

    } catch (error: any) {
        console.error('Pull Sync Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during pull' }
    }
}

export async function syncLiveSellerPrices() {
    try {
        const supabase = await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) {
            throw new Error('Missing Daraz API credentials')
        }

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*').eq('app_type', 'order')
        if (tokensErr || !tokens || tokens.length === 0) {
            throw new Error('No connected seller stores found')
        }

        const allLivePricesToUpsert: any[] = []
        const activeSkusPerStore = new Map<string, Set<string>>()

        for (const token of tokens) {
            const storeName = STORE_NAME_MAP[token.account] || (token.account ? token.account.split('@')[0] : 'Unknown Store')
            const limit = 50
            let offset = 0
            let hasMore = true
            activeSkusPerStore.set(token.store_id, new Set<string>())

            while (hasMore) {
                const params: Record<string, any> = {
                    app_key: appKey,
                    access_token: token.access_token,
                    timestamp: new Date().getTime(),
                    sign_method: 'sha256',
                    filter: 'all',
                    limit: limit,
                    offset: offset
                }

                const apiPath = '/products/get'
                const keys = Object.keys(params).sort()
                let str = apiPath
                keys.forEach(k => { str += k + params[k] })
                params.sign = crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()

                try {
                    const res = await axios.get(`${apiUrl}${apiPath}`, { params })
                    const data = res.data?.data?.products || []

                    for (const prod of data) {
                        const skus = prod.skus || []
                        for (const sku of skus) {
                            if (sku.SellerSku) {
                                const statusVal = (sku.Status || sku.status || prod.primary_status || prod.status || 'active').toString().toLowerCase()
                                const isInactive = statusVal === 'inactive' || statusVal === 'deleted' || statusVal === 'suspended' || statusVal === 'deactivated'

                                if (!isInactive) {
                                    activeSkusPerStore.get(token.store_id)!.add(sku.SellerSku.toLowerCase().trim())

                                    let stockQty = 0

                                    // 1. Check Multi-Warehouse Inventories first
                                    if (Array.isArray(sku.multiWarehouseInventories) && sku.multiWarehouseInventories.length > 0) {
                                        const mwSum = sku.multiWarehouseInventories.reduce((acc: number, item: any) => {
                                            const q = parseInt(item.totalQuantity ?? item.quantity ?? item.sellableQuantity ?? item.multiWarehouseQuantity ?? 0)
                                            return acc + (isNaN(q) ? 0 : q)
                                        }, 0)
                                        if (mwSum > 0) stockQty = mwSum
                                    }

                                    // 2. Check Available field if stockQty still 0
                                    if (stockQty === 0 && (sku.Available !== undefined && sku.Available !== null || sku.available !== undefined && sku.available !== null)) {
                                        const avail = parseInt(sku.Available ?? sku.available)
                                        if (!isNaN(avail) && avail > 0) stockQty = avail
                                    }

                                    // 3. Fallback to standard quantity field
                                    if (stockQty === 0 && sku.quantity !== undefined && sku.quantity !== null) {
                                        const q = parseInt(sku.quantity)
                                        if (!isNaN(q)) stockQty = q
                                    }

                                    allLivePricesToUpsert.push({
                                        store_id: token.store_id,
                                        store_name: storeName,
                                        seller_sku: sku.SellerSku,
                                        sku_id: sku.SkuId ? String(sku.SkuId) : null,
                                        price: parseFloat(sku.price) || 0,
                                        special_price: sku.special_price ? parseFloat(sku.special_price) : null,
                                        quantity: stockQty,
                                        updated_at: new Date().toISOString()
                                    })
                                }
                            }
                        }
                    }

                    if (data.length < limit) {
                        hasMore = false
                    } else {
                        offset += limit
                        await new Promise(r => setTimeout(r, 200)) // rate limit protection
                        if (offset > 15000) hasMore = false // fail safe
                    }
                } catch (err: any) {
                    console.error(`Failed to fetch live prices & stock for ${storeName} at offset ${offset}:`, err.message)
                    hasMore = false // break this store loop on error and continue to next
                }
            }
        }

        if (allLivePricesToUpsert.length > 0) {
            // Upsert active SKUs in batches of 500
            for (let i = 0; i < allLivePricesToUpsert.length; i += 500) {
                const batch = allLivePricesToUpsert.slice(i, i + 500)
                const { error: upsertErr } = await supabase.from('daraz_live_prices').upsert(batch, { onConflict: 'store_id,seller_sku' })
                if (upsertErr) {
                    // Fallback retry if 'status' column doesn't exist in DB schema yet
                    if (upsertErr.message.includes('status') || upsertErr.code === 'PGRST204') {
                        const batchWithoutStatus = batch.map(({ status, ...rest }) => rest)
                        const { error: retryErr } = await supabase.from('daraz_live_prices').upsert(batchWithoutStatus, { onConflict: 'store_id,seller_sku' })
                        if (retryErr) {
                            console.error('Failed to upsert daraz live prices fallback batch:', retryErr.message)
                            throw new Error(`Failed to upsert daraz live prices batch: ${retryErr.message}`)
                        }
                    } else {
                        console.error('Failed to upsert daraz live prices batch:', upsertErr.message)
                        throw new Error(`Failed to upsert daraz live prices batch: ${upsertErr.message}`)
                    }
                }
            }
        }

        // Clean up: Delete any old SKUs in daraz_live_prices that are now inactive or deleted in Daraz
        for (const token of tokens) {
            const activeSet = activeSkusPerStore.get(token.store_id)
            if (activeSet) {
                const { data: existingRows } = await supabase
                    .from('daraz_live_prices')
                    .select('seller_sku')
                    .eq('store_id', token.store_id)

                if (existingRows && existingRows.length > 0) {
                    const toDelete = existingRows
                        .map(r => r.seller_sku)
                        .filter(sku => sku && !activeSet.has(sku.toLowerCase().trim()))

                    if (toDelete.length > 0) {
                        for (let i = 0; i < toDelete.length; i += 100) {
                            const chunk = toDelete.slice(i, i + 100)
                            await supabase
                                .from('daraz_live_prices')
                                .delete()
                                .eq('store_id', token.store_id)
                                .in('seller_sku', chunk)
                        }
                    }
                }
            }
        }

        // Trigger automatic website price push if discount settings are active
        try {
            await autoUpdateWebsitePrices()
        } catch (err: any) {
            console.error('[AUTO-PRICE] Auto update website prices error:', err.message)
        }

        revalidatePath('/dashboard/sales/daraz/average-sales-price')
        return { success: true, count: allLivePricesToUpsert.length, message: `Successfully synced Live Prices & Live Stock for ${allLivePricesToUpsert.length} SKUs across all stores` }
    } catch (error: any) {
        console.error('syncLiveSellerPrices Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during live price sync' }
    }
}

export async function syncLiveSellerPricesForProduct(productId: string) {
    try {
        const supabase = await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) {
            throw new Error('Missing Daraz API credentials')
        }

        const { data: skuRow, error: skuErr } = await supabase
            .from('products')
            .select('seller_sku1, seller_sku2, seller_sku3, seller_sku4')
            .eq('id', productId)
            .single()

        if (skuErr || !skuRow) throw new Error('Product not found')

        const productSkus = [skuRow.seller_sku1, skuRow.seller_sku2, skuRow.seller_sku3, skuRow.seller_sku4].filter(Boolean) as string[]
        if (productSkus.length === 0) throw new Error('Product has no seller SKUs configured')

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*').eq('app_type', 'order')
        if (tokensErr || !tokens || tokens.length === 0) {
            throw new Error('No connected seller stores found')
        }

        const allLivePricesToUpsert: any[] = []

        for (const token of tokens) {
            const storeName = STORE_NAME_MAP[token.account] || (token.account ? token.account.split('@')[0] : 'Unknown Store')

            const params: Record<string, any> = {
                app_key: appKey,
                access_token: token.access_token,
                timestamp: new Date().getTime(),
                sign_method: 'sha256',
                filter: 'all',
                sku_seller_list: JSON.stringify(productSkus)
            }

            const apiPath = '/products/get'
            const keys = Object.keys(params).sort()
            let str = apiPath
            keys.forEach(k => { str += k + params[k] })
            params.sign = crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()

            try {
                const res = await axios.get(`${apiUrl}${apiPath}`, { params })
                const data = res.data?.data?.products || []

                for (const prod of data) {
                    const skus = prod.skus || []
                    for (const sku of skus) {
                        if (sku.SellerSku) {
                            allLivePricesToUpsert.push({
                                store_id: token.store_id,
                                store_name: storeName,
                                seller_sku: sku.SellerSku,
                                sku_id: sku.SkuId ? String(sku.SkuId) : null,
                                price: parseFloat(sku.price) || 0,
                                special_price: sku.special_price ? parseFloat(sku.special_price) : null,
                                quantity: parseInt(sku.quantity) || 0,
                                updated_at: new Date().toISOString()
                            })
                        }
                    }
                }
            } catch (err: any) {
                console.error(`Failed to fetch live prices for ${storeName} for product ${productId}:`, err.message)
            }
        }

        if (allLivePricesToUpsert.length > 0) {
            const { error: upsertErr } = await supabase
                .from('daraz_live_prices')
                .upsert(allLivePricesToUpsert, { onConflict: 'store_id,seller_sku' })
            if (upsertErr) {
                console.error('Failed to upsert daraz live prices:', upsertErr.message)
                throw new Error(`Failed to upsert daraz live prices: ${upsertErr.message}`)
            }
        }

        // Trigger automatic website price push if discount settings are active
        try {
            await autoUpdateWebsitePrices()
        } catch (err: any) {
            console.error('[AUTO-PRICE] Auto update website prices error:', err.message)
        }

        revalidatePath('/dashboard/sales/daraz/average-sales-price')
        return { success: true, count: allLivePricesToUpsert.length, message: `Successfully synced live price for ${allLivePricesToUpsert.length} SKU(s) from Daraz` }
    } catch (error: any) {
        console.error('syncLiveSellerPricesForProduct Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during live price sync' }
    }
}



/**
 * Push the Daraz Price (market_price) for one product to Daraz as a special price.
 * Special price date range: today -> 4 years from today.
 */
export async function pushPriceToDaraz(productId: string, targetStoreIds?: string[], customPrice?: number) {
    try {
        let supabase
        try {
            supabase = await createAdminClient()
        } catch {
            supabase = await createClient()
        }

        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) throw new Error('Missing Daraz API credentials')

        // 1. Resolve product by UUID 'id' OR numeric 'product_id'
        let productRow: any = null

        const { data: byId } = await supabase
            .from('products')
            .select('id, product_id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, regular_price, special_price, est_price')
            .eq('id', productId)
            .maybeSingle()

        productRow = byId

        if (!productRow) {
            const { data: byProdId } = await supabase
                .from('products')
                .select('id, product_id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, regular_price, special_price, est_price')
                .eq('product_id', productId)
                .maybeSingle()
            productRow = byProdId
        }

        if (!productRow) throw new Error('Product not found in inventory')

        const productSkus = [productRow.seller_sku1, productRow.seller_sku2, productRow.seller_sku3, productRow.seller_sku4].filter(Boolean) as string[]
        if (productSkus.length === 0) throw new Error('Product has no seller SKUs configured')

        // 2. Resolve price in daraz_avg_prices by UUID OR string product_id
        let priceRow: any = null

        const { data: priceByUuid } = await supabase
            .from('daraz_avg_prices')
            .select('market_price')
            .eq('product_id', productRow.id)
            .maybeSingle()

        priceRow = priceByUuid

        if ((!priceRow || !priceRow.market_price) && productRow.product_id) {
            const { data: priceByProdId } = await supabase
                .from('daraz_avg_prices')
                .select('market_price')
                .eq('product_id', String(productRow.product_id))
                .maybeSingle()
            if (priceByProdId) priceRow = priceByProdId
        }

        const marketPrice = Number(customPrice) || Number(priceRow?.market_price) || Number(productRow?.special_price) || Number(productRow?.regular_price) || Number(productRow?.est_price) || 0
        if (!marketPrice || marketPrice <= 0) throw new Error('Daraz Price is 0 or not set - enter a price first')

        let { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*').eq('app_type', 'order')
        if (tokensErr || !tokens || tokens.length === 0) throw new Error('No connected seller stores found')

        if (targetStoreIds && targetStoreIds.length > 0) {
            tokens = tokens.filter(t => targetStoreIds.includes(t.store_id))
        }

        if (tokens.length === 0) throw new Error('No matching connected seller accounts found for selection')

        const { data: livePrices } = await supabase
            .from('daraz_live_prices')
            .select('seller_sku, store_id, price, sku_id')
            .in('seller_sku', productSkus)

        const storeSkuMap = new Map<string, Array<{ sku: string, skuId: string | null, currentPrice: number }>>()
        if (livePrices && livePrices.length > 0) {
            for (const lp of livePrices) {
                if (!storeSkuMap.has(lp.store_id)) storeSkuMap.set(lp.store_id, [])
                storeSkuMap.get(lp.store_id)!.push({
                    sku: lp.seller_sku,
                    skuId: lp.sku_id || null,
                    currentPrice: lp.price || 0
                })
            }
        } else {
            for (const token of tokens) {
                storeSkuMap.set(token.store_id, productSkus.map(sku => ({ sku, skuId: null, currentPrice: 0 })))
            }
        }

        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
        const startDate = fmt(now)
        const endDate = fmt(new Date(now.getFullYear() + 4, now.getMonth(), now.getDate()))

        const results: { store: string; skus: string[]; success: boolean; message: string }[] = []

        for (const token of tokens) {
            const skusForStore = storeSkuMap.get(token.store_id)
            if (!skusForStore || skusForStore.length === 0) continue

            const storeName = STORE_NAME_MAP[token.account] || token.account

            // Daraz now requires SkuId (not SellerSku). Use SkuId if available, else fall back to SellerSku.
            const skuXml = skusForStore.map(({ sku, skuId, currentPrice }) => {
                const regularPrice = currentPrice > marketPrice
                    ? currentPrice
                    : Math.ceil(marketPrice * 1.2)
                // Daraz requires SkuId now; SellerSku is deprecated
                const identifierXml = skuId
                    ? '<SkuId>' + skuId + '</SkuId>'
                    : '<SellerSku><![CDATA[' + sku + ']]></SellerSku>'
                return '<Sku>' +
                    identifierXml +
                    '<Price>' + regularPrice.toFixed(2) + '</Price>' +
                    '<SalePrice>' + marketPrice.toFixed(2) + '</SalePrice>' +
                    '<SaleStartDate>' + startDate + '</SaleStartDate>' +
                    '<SaleEndDate>' + endDate + '</SaleEndDate>' +
                    '</Sku>'
            }).join('')

            const xmlPayload = '<Request><Product><Skus>' + skuXml + '</Skus></Product></Request>'

            const apiPath = '/product/price_quantity/update'
            const callParams: Record<string, any> = {
                app_key: appKey,
                access_token: token.access_token,
                timestamp: String(new Date().getTime()),
                sign_method: 'sha256',
                payload: xmlPayload
            }
            const sortedKeys = Object.keys(callParams).sort()
            let signStr = apiPath
            sortedKeys.forEach(k => { signStr += k + callParams[k] })
            callParams.sign = crypto.createHmac('sha256', appSecret).update(signStr).digest('hex').toUpperCase()

            try {
                const res = await axios.post(apiUrl + apiPath, null, { params: callParams })
                const code = String(res.data?.code)
                if (code === '0') {
                    results.push({ store: storeName, skus: skusForStore.map(s => s.sku), success: true, message: 'Price pushed' })
                } else {
                    const detail = res.data?.detail ? JSON.stringify(res.data.detail) : ''
                    results.push({ store: storeName, skus: skusForStore.map(s => s.sku), success: false, message: `${res.data?.message || 'API error code ' + code} ${detail}` })
                }
            } catch (err: any) {
                results.push({ store: storeName, skus: skusForStore.map(s => s.sku), success: false, message: err?.response?.data?.message || err.message })
            }
        }

        const anySuccess = results.some(r => r.success)
        const summary = results.map(r => r.store + ': ' + r.message).join(' | ')

        return { success: anySuccess, message: summary, results }

    } catch (error: any) {
        console.error('pushPriceToDaraz Error:', error)
        return { success: false, message: error.message || 'Unknown error' }
    }
}


/**
 * Push stock quantity for one or more SKUs to Daraz.
 * updates can be an array of { sku: string, quantity: number, store_id: string }
 */
export async function pushStockToDaraz(
    productId: string | Array<{ sku: string, quantity: number, store_id: string }>, 
    updates?: Array<{ sku: string, quantity: number, store_id: string }>,
    supabaseClient?: any
) {
    try {
        const upds: Array<{ sku: string; quantity: number; store_id: string }> = 
            Array.isArray(productId) ? productId : (updates || []);
        const supabase = supabaseClient || await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) throw new Error('Missing Daraz API credentials')

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*').eq('app_type', 'order')
        if (tokensErr || !tokens || tokens.length === 0) throw new Error('No connected seller stores found')

        // Get SKU IDs from live prices cache to use for updates
        const { data: livePrices } = await supabase
            .from('daraz_live_prices')
            .select('seller_sku, store_id, sku_id')
            .in('seller_sku', upds.map(u => u.sku))

        const skuIdMap = new Map<string, string>() // key: store_id:seller_sku
        if (livePrices) {
            (livePrices as any[]).forEach((lp: any) => {
                if (lp.sku_id && lp.store_id && lp.seller_sku) {
                    skuIdMap.set(`${lp.store_id}:${lp.seller_sku}`, String(lp.sku_id))
                }
            })
        }

        const storeUpdates = new Map<string, Array<{ sku: string; quantity: number; store_id: string }>>()
        upds.forEach(u => {
            if (!storeUpdates.has(u.store_id)) storeUpdates.set(u.store_id, [])
            storeUpdates.get(u.store_id)!.push(u)
        })

        const results: { store: string; skus: string[]; success: boolean; message: string }[] = []

        for (const token of tokens) {
            const upds = storeUpdates.get(token.store_id)
            if (!upds || upds.length === 0) continue

            const storeName = STORE_NAME_MAP[token.account] || token.account

            const skuXml = upds.map(({ sku, quantity }) => {
                const skuId = skuIdMap.get(`${token.store_id}:${sku}`)
                const identifierXml = skuId
                    ? '<SkuId>' + skuId + '</SkuId>'
                    : '<SellerSku><![CDATA[' + sku + ']]></SellerSku>'
                return '<Sku>' + identifierXml + '<Quantity>' + quantity + '</Quantity></Sku>'
            }).join('')

            const xmlPayload = '<Request><Product><Skus>' + skuXml + '</Skus></Product></Request>'

            const apiPath = '/product/price_quantity/update'
            const callParams: Record<string, any> = {
                app_key: appKey,
                access_token: token.access_token,
                timestamp: String(new Date().getTime()),
                sign_method: 'sha256',
                payload: xmlPayload
            }
            const sortedKeys = Object.keys(callParams).sort()
            let signStr = apiPath
            sortedKeys.forEach(k => { signStr += k + callParams[k] })
            callParams.sign = crypto.createHmac('sha256', appSecret).update(signStr).digest('hex').toUpperCase()

            try {
                const res = await axios.post(apiUrl + apiPath, null, { params: callParams })
                const code = String(res.data?.code)
                if (code === '0') {
                    results.push({ store: storeName, skus: upds.map(s => s.sku), success: true, message: 'Stock updated' })

                    // Optimistically update local cache
                    for (const u of upds) {
                        await supabase
                            .from('daraz_live_prices')
                            .update({ quantity: u.quantity })
                            .eq('store_id', u.store_id)
                            .eq('seller_sku', u.sku)
                    }
                } else {
                    const detail = res.data?.detail ? JSON.stringify(res.data.detail) : ''
                    results.push({ store: storeName, skus: upds.map(s => s.sku), success: false, message: `${res.data?.message || 'API error code ' + code} ${detail}` })
                }
            } catch (err: any) {
                results.push({ store: storeName, skus: upds.map(s => s.sku), success: false, message: err?.response?.data?.message || err.message })
            }
        }

        const anySuccess = results.some(r => r.success)
        revalidatePath('/dashboard/sales/daraz/average-sales-price')

        return {
            success: anySuccess,
            message: results.map(r => r.store + ': ' + r.message).join(' | '),
            results
        }

    } catch (error: any) {
        console.error('pushStockToDaraz Error:', error)
        return { success: false, message: error.message || 'Unknown error' }
    }
}

/**
 * Update Website prices in bulk by updating the ecommerce_products table in the Ecommerce DB.
 */
export async function updateWebsitePricesBulk(updates: { inventory_id: string, regular_price: number, special_price: number }[]) {
    const ecommerceSupabaseUrl = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL
    const ecommerceServiceRoleKey = process.env.ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY

    if (!ecommerceSupabaseUrl) {
        return { success: false, message: 'Ecommerce URL not configured.' }
    }
    
    if (!ecommerceServiceRoleKey) {
        return { success: false, message: 'Missing ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY in .env.local! Cannot bypass RLS to update prices.' }
    }

    try {
        const ecommerceSupabase = createJSClient(ecommerceSupabaseUrl, ecommerceServiceRoleKey)
        
        const supabase = await createClient()
        const productIds = updates.map(u => u.inventory_id)
        const { data: dbProds } = await supabase
            .from('products')
            .select('id, is_price_locked')
            .in('id', productIds)

        const lockedMap = new Map<string, boolean>()
        dbProds?.forEach(p => lockedMap.set(p.id, !!p.is_price_locked))

        let successCount = 0
        let errorCount = 0

        for (const upd of updates) {
            if (lockedMap.get(upd.inventory_id)) {
                console.log(`[WEBSITE-PRICE-BULK] Skipping locked product inventory_id ${upd.inventory_id}`)
                continue
            }
            // Only update products that already exist with this inventory_id
            const { error, count } = await ecommerceSupabase
                .from('ecommerce_products')
                .update({ 
                    regular_price: upd.regular_price, 
                    special_price: upd.special_price 
                })
                .eq('inventory_id', upd.inventory_id)
            
            if (error) {
                console.error(`Failed to update website price for inventory_id ${upd.inventory_id}:`, error.message)
                errorCount++
            } else {
                successCount++
            }
        }

        revalidatePath('/dashboard/sales/daraz/average-sales-price')
        
        if (errorCount > 0) {
            return { success: true, message: `Updated ${successCount} products. ${errorCount} failed (likely not synced to website yet).` }
        }
        return { success: true, message: `Successfully updated ${successCount} products on Website.` }

    } catch (err: any) {
        console.error('Website Bulk Update Error:', err)
        return { success: false, message: err.message || 'Unknown error occurred.' }
    }
}

export async function updateProductCommissions(productIds: string[]) {
    if (!productIds || productIds.length === 0) return

    const supabase = await createClient()

    // 1. Fetch SKUs for these products to mapping
    const { data: skusData } = await supabase
        .from('products')
        .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4')
        .in('id', productIds)

    if (!skusData) return

    const reverseSkuMap = new Map<string, string>()
    const allSkus: string[] = []
    skusData.forEach(s => {
        if (s.seller_sku1) {
            const sku = s.seller_sku1.toLowerCase().trim()
            reverseSkuMap.set(sku, s.id)
            allSkus.push(sku)
        }
        if (s.seller_sku2) {
            const sku = s.seller_sku2.toLowerCase().trim()
            reverseSkuMap.set(sku, s.id)
            allSkus.push(sku)
        }
        if (s.seller_sku3) {
            const sku = s.seller_sku3.toLowerCase().trim()
            reverseSkuMap.set(sku, s.id)
            allSkus.push(sku)
        }
        if (s.seller_sku4) {
            const sku = s.seller_sku4.toLowerCase().trim()
            reverseSkuMap.set(sku, s.id)
            allSkus.push(sku)
        }
    })

    // 2. Fetch delivered order items matching these product IDs OR matching SKUs
    // Fetch recent 1000 items to get a stable average
    let orderItemsQuery = supabase
        .from('daraz_order_items')
        .select(`
            product_id,
            seller_sku,
            amount,
            quantity,
            daraz_orders!inner(
                id,
                daraz_fees,
                order_status,
                deleted
            )
        `)
        .eq('daraz_orders.order_status', 'Delivered')
        .eq('daraz_orders.deleted', false)
        .not('daraz_orders.daraz_fees', 'is', null)

    // Build the or filter properly
    const filters = [`product_id.in.(${productIds.map(id => `"${id}"`).join(',')})`]
    if (allSkus.length > 0) {
        filters.push(`seller_sku.in.(${allSkus.map(s => `"${s}"`).join(',')})`)
    }
    orderItemsQuery = orderItemsQuery.or(filters.join(','))

    const { data: orderItems } = await orderItemsQuery
        .order('created_at', { ascending: false })
        .limit(1000)

    if (!orderItems || orderItems.length === 0) return

    // Compile order total revenue and order items count
    const orderRevenueMap = new Map<string, number>()
    const orderItemCountMap = new Map<string, number>()

    orderItems.forEach((item: any) => {
        const orderId = item.daraz_orders?.id
        if (!orderId) return
        const itemRevenue = (item.amount || 0) * (item.quantity || 1)
        orderRevenueMap.set(orderId, (orderRevenueMap.get(orderId) || 0) + itemRevenue)
        orderItemCountMap.set(orderId, (orderItemCountMap.get(orderId) || 0) + 1)
    })

    // Group rates by product
    const productRatesMap = new Map<string, { singleItemRates: number[], multiItemRates: number[] }>()

    orderItems.forEach((item: any) => {
        let pid = item.product_id
        if (!pid && item.seller_sku) {
            pid = reverseSkuMap.get(item.seller_sku.toLowerCase().trim())
        }
        if (!pid || !productIds.includes(pid)) return

        const orderId = item.daraz_orders?.id
        const orderFees = Math.abs(item.daraz_orders?.daraz_fees || 0)
        const orderRevenue = orderRevenueMap.get(orderId) || 0
        const orderItemCount = orderItemCountMap.get(orderId) || 1

        if (orderRevenue <= 0 || orderFees <= 0) return

        const rate = (orderFees + 30) / orderRevenue
        if (rate < 0.02 || rate > 0.65) return

        if (!productRatesMap.has(pid)) {
            productRatesMap.set(pid, { singleItemRates: [], multiItemRates: [] })
        }

        const entry = productRatesMap.get(pid)!
        if (orderItemCount === 1) {
            entry.singleItemRates.push(rate)
        } else {
            entry.multiItemRates.push(rate)
        }
    })

    // Update the products table
    for (const pid of productIds) {
        const commData = productRatesMap.get(pid)
        let commissionPercent = 25.00 // Default fallback

        if (commData) {
            if (commData.singleItemRates.length > 0) {
                const sum = commData.singleItemRates.reduce((a, b) => a + b, 0)
                commissionPercent = (sum / commData.singleItemRates.length) * 100
            } else if (commData.multiItemRates.length > 0) {
                const sum = commData.multiItemRates.reduce((a, b) => a + b, 0)
                commissionPercent = (sum / commData.multiItemRates.length) * 100
            }
        }

        await supabase
            .from('products')
            .update({ commission_percent: parseFloat(commissionPercent.toFixed(2)) })
            .eq('id', pid)
    }
}

export async function recalculateAllProductCommissions() {
    const supabase = await createClient()
    const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('is_deleted', false)

    if (!products || products.length === 0) {
        return { success: true, count: 0 }
    }

    const productIds = products.map(p => p.id)
    
    // Process in chunks of 50 to avoid big IN filters
    const chunkSize = 50
    for (let i = 0; i < productIds.length; i += chunkSize) {
        const chunk = productIds.slice(i, i + chunkSize)
        await updateProductCommissions(chunk)
    }

    return { success: true, count: productIds.length }
}

export async function autoUpdateWebsitePrices() {
    const supabase = await createClient()

    // 1. Fetch settings from app_settings
    const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'website_discount_rules')
        .single()

    const settings = settingData?.value || { active: false, percent: 0 }
    if (!settings.active) {
        console.log('[AUTO-PRICE] Discount rules are inactive. Skipping auto website pricing push.')
        return { success: true, count: 0, message: 'Settings are inactive' }
    }

    const discountPercent = parseFloat(settings.percent) || 0

    // 2. Fetch all products (with pagination to bypass 1000 limit)
    const products: any[] = []
    let prodPage = 0
    let hasMoreProds = true

    while (hasMoreProds) {
        const { data: prodChunk, error: prodErr } = await supabase
            .from('products')
            .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name, is_price_locked')
            .eq('is_deleted', false)
            .range(prodPage * 1000, (prodPage + 1) * 1000 - 1)

        if (prodErr) {
            console.error('[AUTO-PRICE] products fetch error:', prodErr.message)
            break
        }
        if (!prodChunk || prodChunk.length === 0) {
            hasMoreProds = false
            break
        }

        products.push(...prodChunk)

        if (prodChunk.length < 1000) {
            hasMoreProds = false
        } else {
            prodPage++
        }
    }

    if (products.length === 0) return { success: true, count: 0 }

    // 3. Fetch all live prices (with pagination to bypass 1000 limit)
    const livePricesMap = new Map<string, number>()
    let livePage = 0
    let hasMoreLive = true

    while (hasMoreLive) {
        const { data: liveChunk, error: liveErr } = await supabase
            .from('daraz_live_prices')
            .select('seller_sku, price, special_price')
            .range(livePage * 1000, (livePage + 1) * 1000 - 1)

        if (liveErr) {
            console.error('[AUTO-PRICE] live prices fetch error:', liveErr.message)
            break
        }
        if (!liveChunk || liveChunk.length === 0) {
            hasMoreLive = false
            break
        }

        liveChunk.forEach(lp => {
            if (!lp.seller_sku) return
            const sku = lp.seller_sku.toLowerCase().trim()
            const activePrice = lp.special_price !== null && lp.special_price > 0 ? lp.special_price : lp.price
            if (activePrice > 0) {
                const current = livePricesMap.get(sku) || Infinity
                if (activePrice < current) {
                    livePricesMap.set(sku, activePrice)
                }
            }
        })

        if (liveChunk.length < 1000) {
            hasMoreLive = false
        } else {
            livePage++
        }
    }

    // 4. Calculate updates for each product
    const updates: Array<{ inventory_id: string, regular_price: number, special_price: number | null }> = []

    products.forEach(p => {
        if (p.is_price_locked) return

        const skus = [p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4]
            .filter(Boolean)
            .map(s => s.toLowerCase().trim())

        if (skus.length === 0) return

        // Find the lowest active price across all SKUs
        let lowestPrice = Infinity
        skus.forEach(sku => {
            if (livePricesMap.has(sku)) {
                const price = livePricesMap.get(sku)!
                if (price < lowestPrice) {
                    lowestPrice = price
                }
            }
        })

        if (lowestPrice === Infinity || lowestPrice <= 0) return

        // Calculate discounted price
        const rawDiscountedPrice = lowestPrice * (1 - discountPercent / 100)
        
        // Round to nearest multiple of 5
        const roundedDiscountedPrice = Math.round(rawDiscountedPrice / 5) * 5
        const roundedRegularPrice = Math.round(lowestPrice / 5) * 5

        updates.push({
            inventory_id: p.id,
            regular_price: roundedRegularPrice,
            special_price: discountPercent > 0 ? roundedDiscountedPrice : null
        })
    })

    if (updates.length === 0) return { success: true, count: 0 }

    // 5. Connect to Ecommerce DB and push
    const ecommerceSupabaseUrl = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL
    const ecommerceServiceRoleKey = process.env.ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY

    if (!ecommerceSupabaseUrl || !ecommerceServiceRoleKey) {
        console.warn('[AUTO-PRICE] Ecommerce credentials missing. Cannot push.')
        return { success: false, message: 'Ecommerce credentials missing' }
    }

    const ecommerceSupabase = createJSClient(ecommerceSupabaseUrl, ecommerceServiceRoleKey)
    let successCount = 0

    // Upsert or update in chunks/loops
    for (const upd of updates) {
        const { error } = await ecommerceSupabase
            .from('ecommerce_products')
            .update({
                regular_price: upd.regular_price,
                special_price: upd.special_price
            })
            .eq('inventory_id', upd.inventory_id)

        if (!error) successCount++
    }

    console.log(`[AUTO-PRICE] Successfully auto-pushed prices for ${successCount} products to storefront website.`)
    return { success: true, count: successCount }
}

/**
 * Toggle the price lock state for a product
 */
export async function toggleProductPriceLock(productId: string, isLocked: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('products')
        .update({ is_price_locked: isLocked })
        .eq('id', productId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true }
}



