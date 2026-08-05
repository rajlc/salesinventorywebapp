'use server'

import { createClient } from '@/lib/supabase/server'
import { StockLedgerItem } from './stock-ledger-service'

export interface StockValuationItem {
    id: string
    product_name: string
    total_stock: number
    stock_value: number | 'Missing'
    total_valuation: number | 'Error'
    stock_value_source: 'average' | 'est' | 'missing' // For debugging/UI hints if needed
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

// Reuse helper
function datSum(...args: number[]) {
    return args.reduce((a, b) => a + (b || 0), 0)
}

export async function getStockValuation(page = 1, limit = 50, search = ''): Promise<ValuationResponse> {
    const supabase = await createClient()

    // 1. Fetch ALL Products and their Total Stock from stock_ledger_view
    const CHUNK_SIZE = 1000
    let allProducts: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        let q = supabase
            .from('stock_ledger_view')
            .select('id, product_name, product_type, total_stock')
            .order('id', { ascending: true })
            .range(offset, offset + CHUNK_SIZE - 1)

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`
            q = q.ilike('product_name', searchTerm)
        }

        const { data: chunk, error } = await q
        if (error) throw new Error(error.message)

        if (!chunk || chunk.length === 0) {
            hasMore = false
        } else {
            allProducts = [...allProducts, ...chunk]
            offset += CHUNK_SIZE
            if (chunk.length < CHUNK_SIZE) hasMore = false
        }
    }

    if (allProducts.length === 0) {
        return {
            data: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            summary: { missingCount: 0, totalValuation: 0 }
        }
    }

    const productIds = allProducts.map(p => p.id)

    // 2. Fetch Prices (Chunked)
    const RELATED_CHUNK_SIZE = 50
    const allPriceReports: any[] = []
    const allProductsExtra: any[] = []

    for (let i = 0; i < productIds.length; i += RELATED_CHUNK_SIZE) {
        const chunk = productIds.slice(i, i + RELATED_CHUNK_SIZE)
        const [prices, extras] = await Promise.all([
            supabase.from('inventory_price_reports_view').select('product_id, average_price').in('product_id', chunk),
            supabase.from('products').select('id, est_price').in('id', chunk)
        ])
        if (prices.data) allPriceReports.push(...prices.data)
        if (extras.data) allProductsExtra.push(...extras.data)
    }

    const priceMap = new Map<string, number>()
    allPriceReports.forEach(p => {
        if (p.average_price) priceMap.set(p.product_id, p.average_price)
    })

    const estPriceMap = new Map<string, number>()
    allProductsExtra.forEach(p => {
        if (p.est_price) estPriceMap.set(p.id, p.est_price)
    })

    // 3. Calculate Valuation
    let globalMissingCount = 0
    let globalTotalValuation = 0
    const valuationItems: StockValuationItem[] = []

    allProducts.forEach(product => {
        const pid = product.id
        const totalStock = Number(product.total_stock) || 0

        // FILTER: Ignore if Stock is 0
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

        // Valuation Logic
        let totalValuation: number | 'Error' = 'Error'

        if (stockValue !== 'Missing') {
            // "if Total Stock is in negative then show 'Error'"
            if (totalStock < 0) {
                totalValuation = 'Error'
            } else {
                totalValuation = (stockValue as number) * totalStock
                globalTotalValuation += totalValuation
            }
        } else {
            // Missing price -> count as missing
            globalMissingCount++
        }

        valuationItems.push({
            id: pid,
            product_name: product.product_name,
            total_stock: totalStock,
            stock_value: stockValue,
            total_valuation: totalValuation,
            stock_value_source: source
        })
    })

    // 6. Sort
    // User Request: "in stock valuation table , in column total stock show top quantity stock in top of page"
    valuationItems.sort((a, b) => b.total_stock - a.total_stock)

    // 7. Paginate
    const totalCount = valuationItems.length
    const totalPages = Math.ceil(totalCount / limit)
    const paginatedData = valuationItems.slice((page - 1) * limit, page * limit)

    return {
        data: paginatedData,
        totalCount,
        totalPages,
        currentPage: page,
        summary: {
            missingCount: globalMissingCount,
            totalValuation: globalTotalValuation
        }
    }
}
