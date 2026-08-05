'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MarketplaceOrder {
    id: string
    sales_id: string
    order_date: string
    customer_name: string
    phone_number: string
    alternative_phone?: string  // Added for messaging app integration
    address?: string
    delivery_branch?: string    // Added for messaging app integration
    delivery_branch_id?: string
    courier_id?: string // Added courier_id
    branch_charge: number
    delivery_charge: number
    total_amount: number
    order_status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Fail Delivered' | 'Cancel' | 'Confirmed Order'
    order_type: 'Import' | 'Create'
    user_type: string
    remarks?: string
    created_at: string
    created_by?: string
    updated_at?: string
    updated_by?: string
    shipped_at?: string
    shipped_by?: string
    delivered_at?: string
    delivered_by?: string
    failed_delivered_at?: string
    failed_delivered_by?: string
    cancelled_at?: string
    cancelled_by?: string
    // Synced fields
    platform?: string
    page_name?: string
    logistic_name?: string
    courier_provider?: string
    courier_consignment_id?: string
    city?: string
    messaging_app_order_id?: string
    confirmed_at?: string
    confirmed_by?: string
    // Relations
    courier?: {           // Added courier relation
        id: string
        courier_name: string
    }
    items?: MarketplaceOrderItem[]
    branch?: {
        id?: string
        branch_name: string
        delivery_charge?: number
    }
}

export interface MarketplaceOrderItem {
    id: string
    order_id: string
    product_id?: string
    product_name: string
    quantity: number
    amount: number
}

export interface CreateMarketplaceOrderData {
    order_date?: string
    customer_name: string
    phone_number: string
    address?: string
    delivery_branch_id?: string
    courier_id?: string // Added courier_id
    branch_charge?: number
    delivery_charge: number
    order_status?: string
    remarks?: string
    items: Array<{
        product_id?: string
        product_name: string
        quantity: number
        amount: number
    }>
}

// ============================================================================
// SALES ID GENERATION
// ============================================================================

/**
 * Generate next Sales ID in format MMDD-10001
 * @param orderDate - Date for the order (defaults to today)
 * @returns Generated Sales ID
 */
export async function generateSalesId(orderDate?: string): Promise<string> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .rpc('generate_marketplace_sales_id', {
            for_date: orderDate || new Date().toISOString().split('T')[0]
        })

    if (error) {
        console.error('Error generating sales ID:', error)
        // Fallback to manual generation if function fails
        const date = new Date(orderDate || Date.now())
        const prefix = (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 90000) + 10001
        return `${prefix}-${random}`
    }

    return data
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new marketplace order with items
 */
export async function createMarketplaceOrder(data: CreateMarketplaceOrderData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Calculate total amount
    const itemsTotal = data.items.reduce((sum, item) => sum + (item.quantity * item.amount), 0)
    const totalAmount = itemsTotal + (data.delivery_charge || 0)

    // Generate Sales ID
    const salesId = await generateSalesId(data.order_date)

    // Create order
    const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert({
            sales_id: salesId,
            order_date: data.order_date || new Date().toISOString().split('T')[0],
            customer_name: data.customer_name,
            phone_number: data.phone_number,
            address: data.address,
            delivery_branch_id: data.delivery_branch_id,
            courier_id: data.courier_id, // Added courier_id
            branch_charge: data.branch_charge || 0,
            delivery_charge: data.delivery_charge || 0,
            total_amount: totalAmount,
            order_status: data.order_status || 'Pending',
            user_type: 'Created',
            order_type: 'Create',
            remarks: data.remarks,
            created_by: user.id
        })
        .select()
        .single()

    if (orderError) throw orderError

    // Create order items
    const itemsToInsert = data.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        amount: item.amount
    }))

    const { error: itemsError } = await supabase
        .from('marketplace_order_items')
        .insert(itemsToInsert)

    if (itemsError) throw itemsError

    revalidatePath('/dashboard/sales/marketplace')
    revalidatePath('/dashboard/profile')

    return { success: true, order, message: 'Order created successfully' }
}

// ============================================================================
// READ
// ============================================================================

interface GetMarketplaceOrdersFilters {
    page?: number
    limit?: number
    search?: string
    status?: string
    startDate?: string
    endDate?: string
    showTodayAndPending?: boolean // Special filter for Sales Entry page
    fiscalYearId?: string
    userType?: string
}

/**
 * Get marketplace orders with optional filtering
 */
export async function getMarketplaceOrders(filters: GetMarketplaceOrdersFilters = {}) {
    const supabase = await createClient()
    const {
        page = 1,
        limit = 50,
        search,
        status,
        startDate,
        endDate,
        showTodayAndPending = false,
        fiscalYearId,
        userType
    } = filters

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(*),
            branch:courier_locations!fk_marketplace_courier_branch(branch_name),
            courier:couriers(id, courier_name),
            created_user:user_profiles!marketplace_orders_created_by_fkey(full_name),
            updated_user:user_profiles!marketplace_orders_updated_by_fkey(full_name),
            shipped_user:user_profiles!marketplace_orders_shipped_by_fkey(full_name),
            delivered_user:user_profiles!marketplace_orders_delivered_by_fkey(full_name),
            failed_delivered_user:user_profiles!marketplace_orders_failed_delivered_by_fkey(full_name),
            returned_to_seller_user:user_profiles!marketplace_orders_returned_to_seller_by_fkey(full_name),
            customer_return_user:user_profiles!marketplace_orders_customer_return_by_fkey(full_name),
            return_delivered_user:user_profiles!marketplace_orders_return_delivered_by_fkey(full_name),
            cancelled_user:user_profiles!marketplace_orders_cancelled_by_fkey(full_name)
        `, { count: 'exact' })

    // Special filter for Sales Entry page
    if (showTodayAndPending) {
        const today = new Date().toISOString().split('T')[0]

        // Show Pending orders from ANY date
        // OR Shipped orders updated/shipped TODAY
        // Using raw PostgREST syntax for complex logic
        query = query.or(`order_status.eq.Pending,and(order_status.eq.Shipped,shipped_at.gte.${today}T00:00:00)`)
    }

    // Fiscal Year Filter
    if (fiscalYearId) {
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fy) {
            query = query
                .gte('order_date', fy.start_date)
                .lte('order_date', fy.end_date)
        }
    }

    // Date range filter
    if (startDate) {
        query = query.gte('order_date', startDate)
    }
    if (endDate) {
        query = query.lte('order_date', endDate)
    }

    // Status filter
    if (status && status !== 'all') {
        query = query.eq('order_status', status)
    }

    if (search && search.trim()) {
        query = query.or(`customer_name.ilike.%${search.trim()}%,phone_number.ilike.%${search.trim()}%,sales_id.ilike.%${search.trim()}%`)
    }

    // User Type filter
    if (userType) {
        query = query.eq('user_type', userType)
    }

    // Ordering and pagination
    query = query
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

    const { data: orders, count, error } = await query

    if (error) throw error

    return {
        orders: orders || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

/**
 * Get single marketplace order with details
 */
export async function getMarketplaceOrderById(id: string) {
    const supabase = await createClient()

    const { data: order, error } = await supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(*),
            branch:courier_locations!fk_marketplace_courier_branch(branch_name, delivery_charge),
            courier:couriers(id, courier_name),
            created_user:user_profiles!marketplace_orders_created_by_fkey(full_name),
            updated_user:user_profiles!marketplace_orders_updated_by_fkey(full_name),
            shipped_user:user_profiles!marketplace_orders_shipped_by_fkey(full_name),
            delivered_user:user_profiles!marketplace_orders_delivered_by_fkey(full_name),
            failed_delivered_user:user_profiles!marketplace_orders_failed_delivered_by_fkey(full_name),
            returned_to_seller_user:user_profiles!marketplace_orders_returned_to_seller_by_fkey(full_name),
            customer_return_user:user_profiles!marketplace_orders_customer_return_by_fkey(full_name),
            return_delivered_user:user_profiles!marketplace_orders_return_delivered_by_fkey(full_name),
            cancelled_user:user_profiles!marketplace_orders_cancelled_by_fkey(full_name)
        `)
        .eq('id', id)
        .single()

    if (error) throw error

    return order
}

// ============================================================================
// UPDATE
// ============================================================================

interface UpdateMarketplaceOrderData {
    customer_name?: string
    phone_number?: string
    address?: string
    delivery_branch_id?: string
    // courier_id?: string  <-- Intentionally omitted to prevent edits
    branch_charge?: number
    delivery_charge?: number
    order_status?: string
    remarks?: string
    items?: Array<{
        product_id?: string
        product_name: string
        quantity: number
        amount: number
    }>
}

/**
 * Update marketplace order (handles timestamp tracking)
 */
export async function updateMarketplaceOrder(id: string, data: UpdateMarketplaceOrderData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get current order to check status changes
    const { data: currentOrder } = await supabase
        .from('marketplace_orders')
        .select('order_status')
        .eq('id', id)
        .single()

    if (!currentOrder) throw new Error('Order not found')

    // Prepare update data
    // Remove items from the data object effectively
    const { items, ...orderUpdateData } = data

    const updateData: any = {
        ...orderUpdateData,
        updated_by: user.id
    }

    // Handle status-specific timestamp updates
    if (data.order_status && data.order_status !== currentOrder.order_status) {
        const now = new Date().toISOString()

        if (data.order_status === 'Shipped') {
            updateData.shipped_at = now
            updateData.shipped_by = user.id
        } else if (data.order_status === 'Delivered') {
            updateData.delivered_at = now
            updateData.delivered_by = user.id
        } else if (data.order_status === 'Returning to Seller') {
            updateData.returned_to_seller_at = now
            updateData.returned_to_seller_by = user.id
        } else if (data.order_status === 'Fail Delivered') {
            updateData.failed_delivered_at = now
            updateData.failed_delivered_by = user.id
        } else if (data.order_status === 'Customer Return') {
            updateData.customer_return_at = now
            updateData.customer_return_by = user.id
        } else if (data.order_status === 'Return Delivered') {
            updateData.return_delivered_at = now
            updateData.return_delivered_by = user.id
        } else if (data.order_status === 'Cancel') {
            updateData.cancelled_at = now
            updateData.cancelled_by = user.id
        }
    }

    // Calculate new total if items changed
    if (items) {
        const itemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.amount), 0)
        updateData.total_amount = itemsTotal + (data.delivery_charge || 0)

        // Delete existing items and insert new ones
        await supabase
            .from('marketplace_order_items')
            .delete()
            .eq('order_id', id)

        const itemsToInsert = items.map(item => ({
            order_id: id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            amount: item.amount
        }))

        await supabase
            .from('marketplace_order_items')
            .insert(itemsToInsert)
    }

    // Update order
    const { data: updatedOrder, error } = await supabase
        .from('marketplace_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    revalidatePath('/dashboard/sales/marketplace')

    return { success: true, order: updatedOrder, message: 'Order updated successfully' }
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete marketplace order (cascade deletes items)
 */
export async function deleteMarketplaceOrder(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('marketplace_orders')
        .delete()
        .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/sales/marketplace')

    return { success: true, message: 'Order deleted successfully' }
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export marketplace orders to CSV format
 */
export async function exportMarketplaceOrders(filters: GetMarketplaceOrdersFilters = {}) {
    const { orders } = await getMarketplaceOrders({ ...filters, limit: 10000 })

    return orders.map(order => ({
        'Sales ID': order.sales_id,
        'Date': order.order_date,
        'Customer Name': order.customer_name,
        'Phone': order.phone_number,
        'Product Name': order.items?.map((item: any) => item.product_name).join(', ') || '',
        'Address': order.address || '',
        'Branch': order.branch?.branch_name || '',
        'Courier': order.courier?.courier_name || '', // Added courier to export
        'Branch Charge': order.branch_charge,
        'Delivery Charge': order.delivery_charge,
        'Total Amount': order.total_amount,
        'Status': order.order_status,
        'Remarks': order.remarks || '',
        'Created At': order.created_at
    }))
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Get Marketplace sales summary by fiscal year
 */
export async function getMarketplaceSalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date, name')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) throw new Error('Fiscal year not found')

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select('id, items:marketplace_order_items(quantity, amount)')
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)
            .neq('order_status', 'Cancel') // Exclude cancelled orders

        if (error) {
            console.error('Orders query error:', error)
            return {
                fiscalYear: fiscalYear.name,
                totalOrders: 0,
                totalQuantity: 0,
                totalAmount: 0
            }
        }

        const orders = data || []
        const totalOrders = orders.length
        const totalQuantity = orders.reduce((sum, order) =>
            sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0)
        const totalAmount = orders.reduce((sum, order) =>
            sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0), 0)

        return {
            fiscalYear: fiscalYear.name,
            totalOrders,
            totalQuantity,
            totalAmount
        }
    } catch (error: any) {
        console.error('getMarketplaceSalesByFiscalYear error:', error)
        return {
            fiscalYear: 'Error',
            totalOrders: 0,
            totalQuantity: 0,
            totalAmount: 0
        }
    }
}

/**
 * Get Marketplace monthly sales breakdown by fiscal year
 */
export async function getMarketplaceMonthlySalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) return []

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select(`
                order_date,
                items:marketplace_order_items(quantity, amount)
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)
            .neq('order_status', 'Cancel')

        if (error) {
            console.error('Monthly orders error:', error)
            return []
        }

        // Group by month
        const monthlyData: { [key: string]: { count: number, total: number } } = {}

        data?.forEach(order => {
            const month = new Date(order.order_date).toISOString().substring(0, 7) // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { count: 0, total: 0 }
            }
            monthlyData[month].count++
            // Calculate total from items
            const orderTotal = order.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0
            monthlyData[month].total += orderTotal
        })

        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month,
                orderCount: data.count,
                totalAmount: data.total
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
    } catch (error: any) {
        console.error('getMarketplaceMonthlySalesByFiscalYear error:', error)
        return []
    }
}

/**
 * Get Marketplace daily sales breakdown by fiscal year (Day by Day)
 */
export async function getMarketplaceDailySalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) return []

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select(`
                order_date,
                items:marketplace_order_items(quantity, amount)
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)
            .neq('order_status', 'Cancel')
            .order('order_date', { ascending: false })

        if (error) {
            console.error('Daily sales error:', error)
            return []
        }

        // Group by date
        const dailyData: { [key: string]: { count: number, quantity: number, total: number } } = {}

        data?.forEach(order => {
            const date = order.order_date
            if (!dailyData[date]) {
                dailyData[date] = { count: 0, quantity: 0, total: 0 }
            }
            dailyData[date].count++

            const orderQty = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0
            const orderTotal = order.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0

            dailyData[date].quantity += orderQty
            dailyData[date].total += orderTotal
        })

        return Object.entries(dailyData)
            .map(([date, data]) => ({
                date,
                orderCount: data.count,
                quantity: data.quantity,
                totalAmount: data.total
            }))
            .sort((a, b) => b.date.localeCompare(a.date)) // Descending by date
    } catch (error: any) {
        console.error('getMarketplaceDailySalesByFiscalYear error:', error)
        return []
    }
}

/**
 * Find a single marketplace order by key
 */
export async function findMarketplaceOrder(key: 'order_number' | 'phone_number', value: string) {
    const supabase = await createClient()

    // Note: marketplace_orders uses 'sales_id' as the human-readable ID, not 'order_number'. 
    // The user requested "Order Number" but in Marketplace context that is likely 'sales_id'.
    // I will map 'order_number' to 'sales_id' for query.

    const searchField = key === 'order_number' ? 'sales_id' : 'phone_number'

    const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(*),
            created_user:user_profiles!marketplace_orders_created_by_fkey(full_name),
            updated_user:user_profiles!marketplace_orders_updated_by_fkey(full_name),
            shipped_user:user_profiles!marketplace_orders_shipped_by_fkey(full_name),
            delivered_user:user_profiles!marketplace_orders_delivered_by_fkey(full_name),
            failed_delivered_user:user_profiles!marketplace_orders_failed_delivered_by_fkey(full_name),
            returned_to_seller_user:user_profiles!marketplace_orders_returned_to_seller_by_fkey(full_name),
            customer_return_user:user_profiles!marketplace_orders_customer_return_by_fkey(full_name),
            return_delivered_user:user_profiles!marketplace_orders_return_delivered_by_fkey(full_name),
            cancelled_user:user_profiles!marketplace_orders_cancelled_by_fkey(full_name)
        `)
        .eq(searchField, value.trim())
        .limit(1) // Just take one if multiple match (e.g. phone number)
        .single()

    if (error) {
        // Returns null if not found
        return null
    }

    return data
}

/**
 * Bulk update marketplace order status
 */
export async function updateMarketplaceOrderStatus(ids: string[], status: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // RESTRICTION: Cannot revert Redirected orders to Pending
    if (status === 'Pending') {
        const { data: redirectedOrders } = await supabase
            .from('marketplace_orders')
            .select('id')
            .in('id', ids)
            .eq('order_status', 'Redirected')

        if (redirectedOrders && redirectedOrders.length > 0) {
            throw new Error('Cannot revert Redirected orders to Pending status.')
        }
    }

    const now = new Date().toISOString()
    const updateData: any = {
        order_status: status,
        updated_by: user.id,
        updated_at: now
    }

    // Handle timestamps
    if (status === 'Shipped') {
        updateData.shipped_at = now
        updateData.shipped_by = user.id
    } else if (status === 'Delivered') {
        updateData.delivered_at = now
        updateData.delivered_by = user.id
    } else if (status === 'Confirmed Order') {
        updateData.confirmed_at = now
        updateData.confirmed_by = user.id
    } else if (status === 'Returning to Seller') {
        updateData.returned_to_seller_at = now
        updateData.returned_to_seller_by = user.id
    } else if (status === 'Fail Delivered') {
        updateData.failed_delivered_at = now
        updateData.failed_delivered_by = user.id
    } else if (status === 'Customer Return') {
        updateData.customer_return_at = now
        updateData.customer_return_by = user.id
    } else if (status === 'Return Delivered') {
        updateData.return_delivered_at = now
        updateData.return_delivered_by = user.id
    } else if (status === 'Cancel') {
        updateData.cancelled_at = now
        updateData.cancelled_by = user.id
    }

    const { error } = await supabase
        .from('marketplace_orders')
        .update(updateData)
        .in('id', ids)

    if (error) throw error

    // Notify messaging app of status change for messenger orders
    try {
        // Get the updated orders to check if they're from messenger (check remarks field)
        const { data: updatedOrders } = await supabase
            .from('marketplace_orders')
            .select('remarks, sales_id')
            .in('id', ids)

        if (updatedOrders && updatedOrders.length > 0) {
            // Check if any orders are from messenger (remarks contains "Messenger Order #")
            const messengerOrders = updatedOrders.filter(order =>
                order.remarks?.includes('Messenger Order #')
            )

            if (messengerOrders.length > 0) {
                const messengerAppUrl = process.env.NEXT_PUBLIC_MESSENGER_APP_URL || 'http://localhost:3001'
                const apiKey = process.env.MESSENGER_APP_API_KEY

                // Send webhook for each messenger order
                for (const order of messengerOrders) {
                    // Extract order number from remarks (e.g., "Messenger Order #WEB-1234)")
                    const match = order.remarks?.match(/Messenger Order #([^)]+)\)/)
                    if (match) {
                        const orderNumber = match[1]

                        try {
                            await fetch(`${messengerAppUrl}/api/orders/status/sync?api_key=${apiKey}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    order_number: orderNumber,
                                    status: status
                                })
                            })
                            console.log(`✅ Notified messaging app: ${orderNumber} -> ${status}`)
                        } catch (webhookError) {
                            console.error(`Failed to notify messaging app for ${orderNumber}:`, webhookError)
                            // Don't throw - webhook failure shouldn't block the main update
                        }
                    }
                }
            }
        }
    } catch (notifyError) {
        console.error('Error notifying messaging app:', notifyError)
        // Don't throw - notification failure shouldn't block the main update
    }

    revalidatePath('/dashboard/sales/marketplace')
    return { success: true }
}
// ============================================================================
// IMPORT
// ============================================================================

/**
 * Bulk import marketplace orders from CSV data
 */
export async function bulkImportMarketplaceOrders(rows: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // 1. Fetch Couriers for matching
    const { data: couriers } = await supabase
        .from('couriers')
        .select('id, courier_name, is_active')

    // Find active courier for default
    const activeCourier = couriers?.find(c => c.is_active)

    // Create a map for name lookup (case-insensitive)
    const courierMap = new Map()
    couriers?.forEach(c => {
        courierMap.set(c.courier_name.toLowerCase(), c.id)
    })

    const results = {
        success: 0,
        failures: [] as any[]
    }

    // Process rows sequentially to generate proper Sales IDs
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        try {
            // Determine Courier ID
            let courierId = activeCourier?.id // Default to active
            const rowCourierName = row['Courier'] || row['courier'] // Check both cases

            if (rowCourierName && rowCourierName.trim()) {
                const foundId = courierMap.get(rowCourierName.trim().toLowerCase())
                if (foundId) {
                    courierId = foundId
                }
            }

            // Generate Sales ID
            // If date is provided utilize it, otherwise use today
            // Expecting date format YYYY-MM-DD
            const orderDate = row['Date'] || row['Order Date'] || new Date().toISOString().split('T')[0]
            const salesId = await generateSalesId(orderDate)

            // Parse Amounts
            const deliveryCharge = parseFloat(row['Delivery Charge'] || row['delivery_charge'] || '0')
            const branchCharge = parseFloat(row['Branch Charge'] || row['branch_charge'] || '0')
            const quantity = parseInt(row['Quantity'] || row['quantity'] || '1')
            const amount = parseFloat(row['Amount'] || row['amount'] || '0')

            // Insert Order
            const { data: order, error: orderError } = await supabase
                .from('marketplace_orders')
                .insert({
                    sales_id: salesId,
                    order_date: orderDate,
                    customer_name: row['Customer Name'] || row['customer_name'] || 'Unknown',
                    phone_number: row['Phone'] || row['phone_number'] || '',
                    address: row['Address'] || row['address'],
                    delivery_branch_id: null, // Basic import implies no branch logic initially
                    courier_id: courierId,
                    branch_charge: branchCharge,
                    delivery_charge: deliveryCharge,
                    // Use item total + delivery for total
                    total_amount: (quantity * amount) + deliveryCharge,
                    order_status: row['Status'] || row['status'] || 'Pending',
                    user_type: 'ALL',
                    remarks: row['Remarks'] || row['remarks'],
                    created_by: user.id
                })
                .select()
                .single()

            if (orderError) throw orderError

            // Insert Item
            const { error: itemError } = await supabase
                .from('marketplace_order_items')
                .insert({
                    order_id: order.id,
                    product_name: row['Product Name'] || row['product_name'] || 'Unknown Product',
                    quantity: quantity,
                    amount: amount
                })

            if (itemError) throw itemError

            results.success++

        } catch (error: any) {
            console.error('Row import error:', error)
            results.failures.push({ row: i + 1, error: error.message })
        }
    }

    revalidatePath('/dashboard/sales/marketplace')
    return results
}

// ============================================================================
// REDIRECT FEATURE
// ============================================================================

/**
 * Find a potential target order for redirection.
 * Target Match Rules:
 * - Status: 'Returning to Seller'
 * - Same Product Name
 * - Same Branch (Location)
 */
export async function findRedirectTarget(sourceOrderId: string) {
    const supabase = await createClient()

    // 1. Get Source Order Details
    const { data: sourceOrder, error: sourceError } = await supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(product_name),
            branch:courier_locations!fk_marketplace_courier_branch(id, branch_name)
        `)
        .eq('id', sourceOrderId)
        .single()

    if (sourceError || !sourceOrder) {
        throw new Error('Source order not found')
    }

    if (!sourceOrder.items?.[0]?.product_name) {
        throw new Error('Source order has no product name')
    }

    const productName = sourceOrder.items[0].product_name
    const branchId = sourceOrder.delivery_branch_id
    const branchName = sourceOrder.branch?.branch_name || ''

    // 2. Find Candidate Targets (Fetch globally, filter locally)
    const { data: targets, error: targetError } = await supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(product_name),
            branch:courier_locations!fk_marketplace_courier_branch(id, branch_name)
        `)
        .eq('order_status', 'Returning to Seller')
        .neq('id', sourceOrderId) // Exclude self
        .is('redirect_related_order_id', null) // Not already redirected/linked
        .order('order_date', { ascending: false })
        .limit(200) // Safety limit

    if (targetError) throw targetError

    // Helper: Levenshtein Distance for fuzzy matching
    const getLevenshteinDistance = (a: string, b: string) => {
        if (a.length === 0) return b.length
        if (b.length === 0) return a.length
        const matrix = []
        for (let i = 0; i <= b.length; i++) matrix[i] = [i]
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                }
            }
        }
        return matrix[b.length][a.length]
    }

    // Scoring & Filtering
    const scoredTargets = targets?.map(t => {
        let score = 0
        const targetBranchName = t.branch?.branch_name || ''
        const targetProductName = t.items?.[0]?.product_name || ''

        // Branch Match
        // Note: We check if branchId is present before strict compare, though source always has it here.
        const isSameBranchId = branchId && t.delivery_branch_id === branchId

        // Fuzzy Branch Name: distance <= 3 or includes
        const dist = getLevenshteinDistance(branchName.toLowerCase(), targetBranchName.toLowerCase())
        // "Kathmandu" (9 chars) vs "katmandu" (8 chars) -> dist 1.
        // "Pokhara" vs "Pokara" -> dist 1.
        // "Lalitpur" vs "Lalipur" -> dist 1.
        // "Baktapur" vs "Bhaktapur" -> dist 1.
        // If dist is small RELATIVE to length, it's a match. <= 3 is generous for short distinct names.
        const isFuzzyBranch = dist <= 3 || targetBranchName.toLowerCase().includes(branchName.toLowerCase()) || branchName.toLowerCase().includes(targetBranchName.toLowerCase())

        if (isSameBranchId) score += 20
        else if (isFuzzyBranch) score += 10

        // Product Match
        if (targetProductName === productName) score += 10
        else if (targetProductName.toLowerCase().includes(productName.toLowerCase())) score += 5

        return { ...t, score, isFuzzyBranch, dist }
    }) || []

    // Filter out completely irrelevant ones (Low score)
    // Keep if Score > 0. This means EITHER branch fuzzy match OR product name partial match.
    // If strict branch was required, we would require score >= 10. But user wants fuzzy.
    const candidates = scoredTargets
        .filter(t => t.score > 0)
        .sort((a, b) => b.score - a.score)

    // Recommended: Must be High Score (e.g. Branch (Fuzzy or ID) + Product)
    // Score >= 15 implies (Branch=10 + Product=5) or (Branch=20). 
    // Ideally we want Branch AND Product.
    const recommended = candidates.find(t => t.score >= 15) || candidates[0] || null

    return {
        recommended: recommended && recommended.score >= 15 ? recommended : null,
        candidates
    }
}

/**
 * Execute the atomic redirect transaction
 */
export async function redirectMarketplaceOrder(data: {
    sourceOrderId: string,
    targetOrderId: string,
    charge: number
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const now = new Date().toISOString()

    // 1. Update Source Order
    const { error: error1 } = await supabase
        .from('marketplace_orders')
        .update({
            order_status: 'Redirected',
            redirect_related_order_id: data.targetOrderId,
            delivery_charge: data.charge,
            updated_at: now,
            updated_by: user.id
        })
        .eq('id', data.sourceOrderId)
        .eq('order_status', 'Pending') // Optimistic locking

    if (error1) throw new Error(`Source update failed: ${error1.message}`)

    // 2. Update Target Order
    const { error: error2 } = await supabase
        .from('marketplace_orders')
        .update({
            order_status: 'Redirected',
            redirect_related_order_id: data.sourceOrderId,
            updated_at: now,
            updated_by: user.id
        })
        .eq('id', data.targetOrderId)
        .eq('order_status', 'Returning to Seller')

    if (error2) {
        // Critical: Source updated, Target failed. Try to rollback Source.
        console.error('Target update failed, rolling back source...')
        await supabase
            .from('marketplace_orders')
            .update({
                order_status: 'Pending',
                redirect_related_order_id: null,
                updated_at: now
            })
            .eq('id', data.sourceOrderId)

        throw new Error(`Redirect failed: ${error2.message}`)
    }

    revalidatePath('/dashboard/sales/marketplace')
    return { success: true }
}
