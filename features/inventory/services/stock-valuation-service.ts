'use server'

import { createClient } from '@/lib/supabase/server'
import { getMemoryCache, setMemoryCache } from '@/lib/cache/memory-cache'

export interface StockValuationItem {
    id: string
    product_name: string
    total_stock: number
    stock_value: number | 'Missing'
    total_valuation: number | 'Error'
    stock_value_source: 'average' | 'est' | 'missing'
}

export interface ValuationSummary {
    missingCount: number
    totalValuation: number
}

export interface ValuationResponse {
    data: StockValuationItem[]
    totalCount: number
    totalPages: number
    currentPage: number
    summary: ValuationSummary
}

interface CachedFullValuation {
    items: StockValuationItem[]
    summary: ValuationSummary
}

export async function getStockValuation(page = 1, limit = 50, search = ''): Promise<ValuationResponse> {
    const fullCacheKey = 'stock_valuation_full_items_v3'
    let fullValuation = getMemoryCache<CachedFullValuation>(fullCacheKey)

    if (!fullValuation) {
        const supabase = await createClient()

        // 1. Run stock_ledger_view ALONE first (no competing heavy view scans on Supabase Free Tier)
        const { data: ledgerRows, error: ledgerErr } = await supabase
            .from('stock_ledger_view')
            .select('id, product_name, total_stock')
            .neq('total_stock', 0)
            .limit(3000)

        if (ledgerErr) {
            throw new Error(ledgerErr.message)
        }

        const allProducts = ledgerRows || []
        const productIds = allProducts.map((p: any) => p.id).filter(Boolean)

        const priceMap = new Map<string, number>()
        const estPriceMap = new Map<string, number>()

        // 2. Compute exact average purchase price & est_price directly from indexed tables
        // (avoids heavy inventory_price_reports_view timeouts and 1,000-row caps!)
        if (productIds.length > 0) {
            const qtySumMap = new Map<string, number>()
            const amtSumMap = new Map<string, number>()
            const latestUnitMap = new Map<string, number>()

            const CHUNK = 200
            for (let i = 0; i < productIds.length; i += CHUNK) {
                const chunkIds = productIds.slice(i, i + CHUNK)

                const [estRes, purchaseRes] = await Promise.all([
                    supabase
                        .from('products')
                        .select('id, est_price')
                        .in('id', chunkIds)
                        .gt('est_price', 0),
                    supabase
                        .from('purchases')
                        .select('product_id, quantity, unit_amount, total_amount, purchase_type, purchase_date')
                        .in('product_id', chunkIds)
                        .order('purchase_date', { ascending: false })
                        .limit(5000),
                ])

                for (const p of estRes.data || []) {
                    const est = Number(p.est_price)
                    if (p.id && est > 0) estPriceMap.set(p.id, est)
                }

                for (const pr of purchaseRes.data || []) {
                    if (!pr.product_id) continue
                    if ((pr.purchase_type || 'Buy').toLowerCase() === 'sell') continue
                    const qty = Number(pr.quantity) || 0
                    const unit = Number(pr.unit_amount) || 0
                    const total = Number(pr.total_amount) || qty * unit

                    if (unit > 0 && !latestUnitMap.has(pr.product_id)) {
                        latestUnitMap.set(pr.product_id, unit)
                    }
                    if (qty > 0 && total > 0) {
                        qtySumMap.set(pr.product_id, (qtySumMap.get(pr.product_id) || 0) + qty)
                        amtSumMap.set(pr.product_id, (amtSumMap.get(pr.product_id) || 0) + total)
                    }
                }
            }

            for (const pid of productIds) {
                const totalQty = qtySumMap.get(pid) || 0
                const totalAmt = amtSumMap.get(pid) || 0
                if (totalQty > 0 && totalAmt > 0) {
                    priceMap.set(pid, Math.round((totalAmt / totalQty) * 100) / 100)
                } else if (latestUnitMap.has(pid)) {
                    priceMap.set(pid, latestUnitMap.get(pid)!)
                }
            }
        }

        let globalMissingCount = 0
        let globalTotalValuation = 0
        const valuationItems: StockValuationItem[] = []

        allProducts.forEach((product: any) => {
            const pid = product.id
            const totalStock = Number(product.total_stock) || 0
            if (totalStock === 0) return

            const avgPrice = priceMap.get(pid)
            const estPrice = estPriceMap.get(pid)

            let stockValue: number | 'Missing' = 'Missing'
            let source: 'average' | 'est' | 'missing' = 'missing'

            if (avgPrice && avgPrice > 0) {
                stockValue = avgPrice
                source = 'average'
            } else if (estPrice && estPrice > 0) {
                stockValue = estPrice
                source = 'est'
            }

            let totalValuation: number | 'Error' = 'Error'
            if (stockValue !== 'Missing') {
                if (totalStock < 0) {
                    totalValuation = 'Error'
                } else {
                    totalValuation = (stockValue as number) * totalStock
                    globalTotalValuation += totalValuation
                }
            } else {
                globalMissingCount++
            }

            valuationItems.push({
                id: pid,
                product_name: product.product_name,
                total_stock: totalStock,
                stock_value: stockValue,
                total_valuation: totalValuation,
                stock_value_source: source,
            })
        })

        valuationItems.sort((a, b) => b.total_stock - a.total_stock)

        fullValuation = {
            items: valuationItems,
            summary: {
                missingCount: globalMissingCount,
                totalValuation: globalTotalValuation,
            },
        }
        setMemoryCache(fullCacheKey, fullValuation, 120)
    }

    // Apply search filter & pagination in 0ms from cached full valuation
    const cleanSearch = (search || '').trim().toLowerCase()
    const filteredItems = cleanSearch
        ? fullValuation.items.filter(item => (item.product_name || '').toLowerCase().includes(cleanSearch))
        : fullValuation.items

    let summary = fullValuation.summary
    if (cleanSearch) {
        let missingCount = 0
        let totalValuation = 0
        filteredItems.forEach(item => {
            if (item.stock_value === 'Missing') missingCount++
            else if (typeof item.total_valuation === 'number') totalValuation += item.total_valuation
        })
        summary = { missingCount, totalValuation }
    }

    const totalCount = filteredItems.length
    const totalPages = Math.ceil(totalCount / limit)
    const paginatedData = filteredItems.slice((page - 1) * limit, page * limit)

    return {
        data: paginatedData,
        totalCount,
        totalPages,
        currentPage: page,
        summary,
    }
}
