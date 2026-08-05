'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Types
interface StoreSaleItem {
    product_id?: string
    product_name: string
    product_code?: string
    qty: number
    amount: number
}

interface CreateStoreSaleData {
    sale_date: string
    customer_name?: string
    payment_type?: string
    remarks?: string
    items: StoreSaleItem[]
}

interface GetStoreSalesOptions {
    page?: number
    limit?: number
    search?: string
    fromDate?: string
    toDate?: string
    fiscalYearId?: string
}

// Get all store sales with pagination and fiscal year filtering
export async function getStoreSales(options: GetStoreSalesOptions = {}) {
    const { page = 1, limit = 20, search = '', fromDate, toDate, fiscalYearId } = options
    const offset = (page - 1) * limit

    const supabase = await createClient()

    // Get fiscal year date range if specified
    let fyStart: string | null = null
    let fyEnd: string | null = null

    if (fiscalYearId) {
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fy) {
            fyStart = fy.start_date
            fyEnd = fy.end_date
        }
    } else {
        // Get active fiscal year
        const { data: activeFy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('is_active', true)
            .single()

        if (activeFy) {
            fyStart = activeFy.start_date
            fyEnd = activeFy.end_date
        }
    }

    // Build query
    let query = supabase
        .from('store_sales')
        .select(`
            *,
            items:store_sales_items(*)
        `, { count: 'exact' })
        .eq('deleted', false)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })

    // Apply fiscal year filter
    if (fyStart && fyEnd) {
        query = query.gte('sale_date', fyStart).lte('sale_date', fyEnd)
    }

    // Apply date range filter
    if (fromDate) {
        query = query.gte('sale_date', fromDate)
    }
    if (toDate) {
        query = query.lte('sale_date', toDate)
    }

    // Apply search
    if (search) {
        query = query.or(`customer_name.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
        console.error('Error fetching store sales:', error)
        return { error: error.message }
    }

    return {
        sales: data || [],
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    }
}

// Get single store sale by ID
export async function getStoreSaleById(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('store_sales')
        .select(`
            *,
            items:store_sales_items(*)
        `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching store sale:', error)
        return { error: error.message }
    }

    return { data }
}

// Create new store sale
export async function createStoreSale(saleData: CreateStoreSaleData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Calculate total amount
    const totalAmount = saleData.items.reduce((sum, item) => sum + (item.qty * item.amount), 0)

    // Create sale header
    const { data: sale, error: saleError } = await supabase
        .from('store_sales')
        .insert({
            sale_date: saleData.sale_date,
            customer_name: saleData.customer_name?.trim() || 'User',
            payment_type: saleData.payment_type || 'Cash',
            remarks: saleData.remarks,
            total_amount: totalAmount,
            created_by: user?.id,
            updated_by: user?.id
        })
        .select()
        .single()

    if (saleError) {
        console.error('Error creating store sale:', saleError)
        return { error: saleError.message }
    }

    // Create sale items
    const itemsToInsert = saleData.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        product_code: item.product_code,
        qty: item.qty,
        amount: item.amount
    }))

    const { error: itemsError } = await supabase
        .from('store_sales_items')
        .insert(itemsToInsert)

    if (itemsError) {
        console.error('Error creating sale items:', itemsError)
        // Rollback: delete the sale header
        await supabase.from('store_sales').delete().eq('id', sale.id)
        return { error: itemsError.message }
    }

    // Log the sale creation activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')
        await logActivity('sale_created', {
            customer_name: saleData.customer_name?.trim() || 'User',
            amount: totalAmount
        })
    } catch (logError) {
        console.error('Failed to log sale creation:', logError)
    }

    revalidatePath('/dashboard/sales/store-sales')
    return { data: sale }
}

// Update store sale
export async function updateStoreSale(id: string, saleData: CreateStoreSaleData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Calculate total amount
    const totalAmount = saleData.items.reduce((sum, item) => sum + (item.qty * item.amount), 0)

    // Update sale header
    const { error: saleError } = await supabase
        .from('store_sales')
        .update({
            sale_date: saleData.sale_date,
            customer_name: saleData.customer_name?.trim() || 'User',
            payment_type: saleData.payment_type || 'Cash',
            remarks: saleData.remarks,
            total_amount: totalAmount,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (saleError) {
        console.error('Error updating store sale:', saleError)
        return { error: saleError.message }
    }

    // Delete existing items and insert new ones
    await supabase.from('store_sales_items').delete().eq('sale_id', id)

    const itemsToInsert = saleData.items.map(item => ({
        sale_id: id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        product_code: item.product_code,
        qty: item.qty,
        amount: item.amount
    }))

    const { error: itemsError } = await supabase
        .from('store_sales_items')
        .insert(itemsToInsert)

    if (itemsError) {
        console.error('Error updating sale items:', itemsError)
        return { error: itemsError.message }
    }

    // Log the sale update activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')
        await logActivity('sale_updated', {
            customer_name: saleData.customer_name?.trim() || 'User',
            amount: totalAmount
        })
    } catch (logError) {
        console.error('Failed to log sale update:', logError)
    }

    revalidatePath('/dashboard/sales/store-sales')
    return { success: true }
}

// Soft delete store sale
export async function deleteStoreSale(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('store_sales')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        console.error('Error deleting store sale:', error)
        return { error: error.message }
    }

    revalidatePath('/dashboard/sales/store-sales')
    return { success: true }
}

// Get user display name for created_by/updated_by
export async function getUserDisplayName(userId: string) {
    const supabase = await createClient()

    const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single()

    if (data) {
        return data.full_name || data.email || 'Unknown'
    }
    return 'Unknown'
}

// Get analytics data for report page
export async function getStoreSalesAnalytics(fiscalYearId?: string) {
    const supabase = await createClient()

    let fy

    if (fiscalYearId) {
        const { data } = await supabase
            .from('fiscal_years')
            .select('*')
            .eq('id', fiscalYearId)
            .single()
        fy = data
    } else {
        // 1. Get active fiscal year
        const { data } = await supabase
            .from('fiscal_years')
            .select('*')
            .eq('is_active', true)
            .single()
        fy = data
    }

    if (!fy) {
        return { error: 'No fiscal year found' }
    }

    // 2. Fetch all non-deleted sales for this FY
    const { data: sales, error } = await supabase
        .from('store_sales')
        .select(`
            id,
            sale_date,
            total_amount,
            items:store_sales_items(qty)
        `)
        .eq('deleted', false)
        .gte('sale_date', fy.start_date)
        .lte('sale_date', fy.end_date)
        .order('sale_date', { ascending: true })

    if (error) {
        console.error('Error details:', error)
        return { error: error.message }
    }

    // 3. Process data
    const today = new Date().toISOString().split('T')[0]

    // Initialize totals
    let totalSales = 0
    let totalQty = 0
    let todaySales = 0
    let todayQty = 0

    // Monthly breakdown map
    const monthlyData: Record<string, { sales: number, qty: number }> = {}

    // Daily breakdown map (for last 7 days)
    const dailyData: Record<string, number> = {}

    sales.forEach(sale => {
        const amount = Number(sale.total_amount) || 0
        const qty = sale.items?.reduce((sum: number, item: any) => sum + (item.qty || 0), 0) || 0

        // Total
        totalSales += amount
        totalQty += qty

        // Today
        if (sale.sale_date === today) {
            todaySales += amount
            todayQty += qty
        }

        // Monthly
        const date = new Date(sale.sale_date)
        const monthKey = date.toLocaleDateString('en-NP', { month: 'short', year: 'numeric' })

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { sales: 0, qty: 0 }
        }
        monthlyData[monthKey].sales += amount
        monthlyData[monthKey].qty += qty

        // Daily (map all, filter later)
        if (!dailyData[sale.sale_date]) {
            dailyData[sale.sale_date] = 0
        }
        dailyData[sale.sale_date] += amount
    })

    // Prepare chart data
    // Last 7 Days
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        last7Days.push({
            date: dateStr,
            displayDate: d.toLocaleDateString('en-NP', { day: 'numeric', month: 'short' }),
            sales: dailyData[dateStr] || 0
        })
    }

    // Monthly
    const monthlyBreakdown = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        sales: data.sales,
        qty: data.qty
    }))

    return {
        fiscalYear: {
            name: fy.fiscal_year,
            startDate: fy.start_date,
            endDate: fy.end_date
        },
        summary: {
            totalSales,
            totalQty,
            todaySales,
            todayQty
        },
        charts: {
            last7Days,
            monthlyBreakdown
        }
    }
}
