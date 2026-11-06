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
    const fullCacheKey = 'stock_valuation_full_items'
    let fullValuation = getMemoryCache<CachedFullValuation>(fullCacheKey)

    if (!fullValuation) {
        const supabase = await createClient()

        // Fetch non-zero stock products, average prices, and est_prices in 3 parallel queries (instead of 16+ chunk queries)
        const [ledgerRes, priceReportsRes, productsExtraRes] = await Promise.all([
            supabase
                .from('stock_ledger_view')
                .select('id, product_name, product_type, total_stock')
                .neq('total_stock', 0)
                .limit(3000),
            supabase
                .from('inventory_price_reports_view')
                .select('product_id, average_price')
                .limit(3000),
            supabase
                .from('products')
                .select('id, est_price')
                .eq('is_deleted', false)
                .gt('est_price', 0)
                .limit(3000),
        ])

        if (ledgerRes.error) throw new Error(ledgerRes.error.message)

        const allProducts = ledgerRes.data || []
        const priceMap = new Map<string, number>()
        ;(priceReportsRes.data || []).forEach((p: any) => {
            if (p.average_price) priceMap.set(p.product_id, Number(p.average_price))
        })

        const estPriceMap = new Map<string, number>()
        ;(productsExtraRes.data || []).forEach((p: any) => {
            if (p.est_price) estPriceMap.set(p.id, Number(p.est_price))
        })

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
        setMemoryCache(fullCacheKey, fullValuation, 60)
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
