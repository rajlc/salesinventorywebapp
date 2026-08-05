'use server'

import { createClient } from '@/lib/supabase/server'

// Get all fiscal years
export async function getFiscalYears() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .order('start_date', { ascending: false })

    if (error) throw error

    return { data }
}

// Get active fiscal year
export async function getActiveFiscalYear() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('is_active', true)
        .single()

    if (error && error.code !== 'PGRST116') throw error // Ignore "not found" errors

    return { data }
}

// Get purchase statistics for a specific fiscal year
export async function getPurchasesByFiscalYear(fiscalYearId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get fiscal year details
    const { data: fiscalYear, error: fyError } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', fiscalYearId)
        .single()

    if (fyError) throw fyError

    // Get purchases within fiscal year date range
    const { data: purchases, error } = await supabase
        .from('purchases')
        .select('*')
        .gte('purchase_date', fiscalYear.start_date)
        .lte('purchase_date', fiscalYear.end_date)
        .order('purchase_date', { ascending: false })

    if (error) throw error

    // Calculate aggregations
    const totalPurchases = purchases?.length || 0
    const totalAmount = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0
    const totalQuantity = purchases?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0

    return {
        fiscalYear,
        purchases,
        stats: {
            totalPurchases,
            totalAmount,
            totalQuantity
        }
    }
}

// Get monthly breakdown for a fiscal year
export async function getPurchaseStatsByMonth(fiscalYearId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get fiscal year details
    const { data: fiscalYear, error: fyError } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', fiscalYearId)
        .single()

    if (fyError) throw fyError

    // Get purchases within fiscal year
    const { data: purchases, error } = await supabase
        .from('purchases')
        .select('purchase_date, quantity, total_amount')
        .gte('purchase_date', fiscalYear.start_date)
        .lte('purchase_date', fiscalYear.end_date)

    if (error) throw error

    // Group by month
    const monthlyData: Record<string, { month: string; purchases: number; quantity: number; amount: number }> = {}

    purchases?.forEach(purchase => {
        const date = new Date(purchase.purchase_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: monthLabel,
                purchases: 0,
                quantity: 0,
                amount: 0
            }
        }

        monthlyData[monthKey].purchases += 1
        monthlyData[monthKey].quantity += purchase.quantity || 0
        monthlyData[monthKey].amount += purchase.total_amount || 0
    })

    // Convert to array and sort by month
    const monthlyStats = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month))

    return { monthlyStats }
}

// Get last 30 days purchase data
export async function getPurchasesLast30Days() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]

    // Get purchases from last 30 days
    const { data: purchases, error } = await supabase
        .from('purchases')
        .select('purchase_date, quantity, total_amount')
        .gte('purchase_date', startDate)

    if (error) throw error

    // Group by day
    const dailyData: Record<string, { date: string; purchases: number; quantity: number; amount: number }> = {}

    purchases?.forEach(purchase => {
        const dateKey = purchase.purchase_date

        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                date: dateKey,
                purchases: 0,
                quantity: 0,
                amount: 0
            }
        }

        dailyData[dateKey].purchases += 1
        dailyData[dateKey].quantity += purchase.quantity || 0
        dailyData[dateKey].amount += purchase.total_amount || 0
    })

    // Convert to array and sort by date
    const dailyStats = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date))

    return { dailyStats }
}

// Get product-wise purchase summary for a fiscal year
export async function getPurchasesByProduct(fiscalYearId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get fiscal year details
    const { data: fiscalYear, error: fyError } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', fiscalYearId)
        .single()

    if (fyError) throw fyError

    // Get purchases within fiscal year
    const { data: purchases, error } = await supabase
        .from('purchases')
        .select('product:products(product_name), quantity, total_amount')
        .gte('purchase_date', fiscalYear.start_date)
        .lte('purchase_date', fiscalYear.end_date)

    if (error) throw error

    // Group by product
    const productData: Record<string, { productName: string; totalQuantity: number; totalAmount: number; purchaseCount: number }> = {}

    purchases?.forEach((purchase: any) => {
        const productName = purchase.product?.product_name || 'Unknown'

        if (!productData[productName]) {
            productData[productName] = {
                productName,
                totalQuantity: 0,
                totalAmount: 0,
                purchaseCount: 0
            }
        }

        productData[productName].totalQuantity += Number(purchase.quantity || 0)
        productData[productName].totalAmount += purchase.total_amount || 0
        productData[productName].purchaseCount += 1
    })

    // Convert to array and sort by total quantity (descending)
    const productStats = Object.values(productData)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 15) // Top 15 products

    return { productStats }
}

// Get top products for last 30 days
export async function getTopProductsLast30Days() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]

    // Get purchases from last 30 days
    const { data: purchases, error } = await supabase
        .from('purchases')
        .select('product:products(product_name), quantity, total_amount')
        .gte('purchase_date', startDate)

    if (error) throw error

    // Group by product
    const productData: Record<string, { productName: string; totalQuantity: number; totalAmount: number; purchaseCount: number }> = {}

    purchases?.forEach((purchase: any) => {
        const productName = purchase.product?.product_name || 'Unknown'

        if (!productData[productName]) {
            productData[productName] = {
                productName,
                totalQuantity: 0,
                totalAmount: 0,
                purchaseCount: 0
            }
        }

        productData[productName].totalQuantity += Number(purchase.quantity || 0)
        productData[productName].totalAmount += purchase.total_amount || 0
        productData[productName].purchaseCount += 1
    })

    // Convert to array and sort by quantity (descending)
    const productStats = Object.values(productData)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 15) // Top 15 products

    return { productStats }
}
// Get daily purchase stats with optional filtering
export async function getDailyPurchaseReport(params: {
    startDate?: string
    endDate?: string
    fiscalYearId?: string
}) {
    const { startDate, endDate, fiscalYearId } = params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
        .from('purchases')
        .select('purchase_date, total_amount, purchase_type')
        .order('purchase_date', { ascending: false })

    // Apply Fiscal Year Filter
    if (fiscalYearId) {
        const { data: fiscalYear } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fiscalYear) {
            query = query
                .gte('purchase_date', fiscalYear.start_date)
                .lte('purchase_date', fiscalYear.end_date)
        }
    }

    // Apply Date Range Filters (override FY if provided)
    if (startDate) query = query.gte('purchase_date', startDate)
    if (endDate) query = query.lte('purchase_date', endDate)

    const { data: purchases, error } = await query

    if (error) throw error

    // Group by date
    const dailyData: Record<string, { date: string; purchases: number; totalAmount: number; salesAmount: number; purchaseAmount: number }> = {}

    purchases?.forEach(purchase => {
        const dateKey = purchase.purchase_date

        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                date: dateKey,
                purchases: 0,
                totalAmount: 0,
                salesAmount: 0,
                purchaseAmount: 0
            }
        }

        dailyData[dateKey].purchases += 1
        dailyData[dateKey].totalAmount += purchase.total_amount || 0

        const type = (purchase.purchase_type || '').toLowerCase()
        if (type === 'sell') {
            dailyData[dateKey].salesAmount += purchase.total_amount || 0
        } else if (type === 'buy') {
            dailyData[dateKey].purchaseAmount += purchase.total_amount || 0
        }
    })

    // Convert to array and sort by date descending
    const dailyStats = Object.values(dailyData).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { dailyStats }
}
