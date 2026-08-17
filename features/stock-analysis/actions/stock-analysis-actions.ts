'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveFiscalYear } from '@/features/settings/actions/settingsActions'

export interface StockAnalysisItem {
    particulars: string
    hs_code: string
    opening_stock: number
    purchase_stock: number
    purchase_amount: number
    sales_qty: number
    running_stock: number
    weighted_average_rate: number
    unit?: string
}

// Internal type includes all-time purchase totals for rate fallback (not exposed in the interface)
interface InternalEntry extends StockAnalysisItem {
    _all_time_purchase_stock: number
    _all_time_purchase_amount: number
}

export async function getStockAnalysisData(filters?: {
    fiscalYearId?: string
    companyId?: string
    search?: string
}): Promise<StockAnalysisItem[]> {
    const supabase = await createClient()

    // 1. Determine Date Range
    let startDate: string
    let endDate: string

    if (filters?.fiscalYearId && filters.fiscalYearId !== 'all') {
        const { data: fy, error } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', filters.fiscalYearId)
            .single()

        if (error) throw new Error('Fiscal Year not found')
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        // If 'all' is explicitly passed, we set a very old start date
        if (filters?.fiscalYearId === 'all') {
            startDate = '2000-01-01'
            endDate = new Date().toISOString()
        } else {
            const { data: activeFy, error: fyError } = await getActiveFiscalYear()
            if (fyError || !activeFy) throw new Error('No active fiscal year found')
            startDate = activeFy.start_date
            endDate = activeFy.end_date
        }
    }

    // 2. Fetch All Valid Purchase Items to Aggregate (no date filter — we need all-time for rate fallback)
    let purchaseQuery = supabase
        .from('pan_vat_bill_items')
        .select(`
            *,
            pan_vat_bills!inner (
                issue_bill_date_ad,
                buyer_company_id,
                is_deleted
            )
        `)
        .eq('pan_vat_bills.is_deleted', false)

    // Filter by company (buyer)
    if (filters?.companyId && filters.companyId !== 'all') {
        purchaseQuery = purchaseQuery.eq('pan_vat_bills.buyer_company_id', filters.companyId)
    }

    if (filters?.search) {
        purchaseQuery = purchaseQuery.ilike('particulars', `%${filters.search}%`)
    }

    const { data: allPurchaseItems, error: purchaseError } = await purchaseQuery

    if (purchaseError) {
        console.error('Error fetching purchase stock data:', purchaseError)
        throw purchaseError
    }

    // 3. Fetch All Valid Sales Items to Aggregate
    let salesQuery = supabase
        .from('sales_bill_items')
        .select(`
            *,
            sales_bills!inner (
                bill_date_ad,
                seller_company_id,
                is_deleted
            )
        `)
        .eq('sales_bills.is_deleted', false)

    // Filter by company (seller)
    if (filters?.companyId && filters.companyId !== 'all') {
        salesQuery = salesQuery.eq('sales_bills.seller_company_id', filters.companyId)
    }

    if (filters?.search) {
        salesQuery = salesQuery.ilike('particulars', `%${filters.search}%`)
    }

    const { data: allSalesItems, error: salesError } = await salesQuery

    if (salesError) {
        console.error('Error fetching sales stock data:', salesError)
        throw salesError
    }

    // 4. Aggregate Data in Memory (Grouping by Particulars)
    const productMap = new Map<string, InternalEntry>()

    // Aggregate Purchases
    for (const item of allPurchaseItems) {
        const productName = item.particulars.trim()
        const billDate = item.pan_vat_bills.issue_bill_date_ad

        if (!productMap.has(productName)) {
            productMap.set(productName, {
                particulars: productName,
                hs_code: item.hs_code || '',
                opening_stock: 0,
                purchase_stock: 0,
                purchase_amount: 0,
                sales_qty: 0,
                running_stock: 0,
                weighted_average_rate: 0,
                unit: item.unit || 'Pcs',
                _all_time_purchase_stock: 0,
                _all_time_purchase_amount: 0,
            })
        }

        const entry = productMap.get(productName)!

        if (item.hs_code) entry.hs_code = item.hs_code

        // Always accumulate all-time purchase totals (for rate fallback)
        if (item.quantity > 0 && item.amount > 0) {
            entry._all_time_purchase_stock += item.quantity
            entry._all_time_purchase_amount += item.amount
        }

        if (billDate < startDate) {
            entry.opening_stock += item.quantity
        } else if (billDate >= startDate && billDate <= endDate) {
            entry.purchase_stock += item.quantity
            entry.purchase_amount += item.amount
        }
    }

    // Aggregate Sales
    for (const item of allSalesItems || []) {
        const productName = item.particulars.trim()
        const billDate = item.sales_bills.bill_date_ad

        if (!productMap.has(productName)) {
            productMap.set(productName, {
                particulars: productName,
                hs_code: item.hs_code || '',
                opening_stock: 0,
                purchase_stock: 0,
                purchase_amount: 0,
                sales_qty: 0,
                running_stock: 0,
                weighted_average_rate: 0,
                _all_time_purchase_stock: 0,
                _all_time_purchase_amount: 0,
            })
        }

        const entry = productMap.get(productName)!

        if (item.hs_code && !entry.hs_code) entry.hs_code = item.hs_code

        if (billDate < startDate) {
            entry.opening_stock -= item.quantity
        } else if (billDate >= startDate && billDate <= endDate) {
            entry.sales_qty += item.quantity
        }
    }

    // 5. Final Calculations (Running Stock & Valuation Rate)
    const results = Array.from(productMap.values()).map(entry => {
        // Running Stock = Opening + Purchase - Sales
        entry.running_stock = entry.opening_stock + entry.purchase_stock - entry.sales_qty

        // Purchase Rate (weighted average):
        // - Primary: use purchases within the selected period
        // - Fallback: if no purchases in this period (opening stock from older FYs),
        //   use all-time weighted average so the rate column is never 0 for products with history
        if (entry.purchase_stock > 0) {
            entry.weighted_average_rate = entry.purchase_amount / entry.purchase_stock
        } else if (entry._all_time_purchase_stock > 0) {
            // All-time fallback rate (historical cost price)
            entry.weighted_average_rate = entry._all_time_purchase_amount / entry._all_time_purchase_stock
        } else {
            entry.weighted_average_rate = 0
        }

        // Strip internal fields from the returned object
        const { _all_time_purchase_stock, _all_time_purchase_amount, ...publicEntry } = entry
        return publicEntry as StockAnalysisItem
    })

    // Sort by name
    results.sort((a, b) => a.particulars.localeCompare(b.particulars))

    return results
}
