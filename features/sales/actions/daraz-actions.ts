'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Types
interface DarazOrderItem {
    seller_sku: string
    quantity: number
    amount: number
    item_sequence: number
}

interface CreateDarazOrderData {
    order_number: string
    tracking_number: string
    customer_name: string
    order_date: string
    order_status: string
    remarks?: string
    items: DarazOrderItem[]
}

interface FiscalYear {
    id: string
    name: string
    start_date: string
    end_date: string
    is_active: boolean
}

interface GetDarazOrdersParams {
    page?: number
    limit?: number
    status?: string
    todayOnly?: boolean
    fiscalYearId?: string
    sellerAccount?: string
    unprintedOnly?: boolean
}

// Create new Daraz order with items
export async function createDarazOrder(data: CreateDarazOrderData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        // Generate invoice number
        const { data: invoiceData, error: invoiceError } = await supabase
            .rpc('generate_daraz_invoice_number')

        if (invoiceError) throw invoiceError

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('daraz_orders')
            .insert({
                invoice_number: invoiceData,
                order_number: data.order_number,
                tracking_number: data.tracking_number,
                customer_name: data.customer_name,
                order_date: data.order_date,
                order_status: data.order_status,
                remarks: data.remarks,
                created_by: user.id,
                order_source: 'manual',
                import_source: 'manual'
            })
            .select()
            .single()

        if (orderError) throw orderError

        // Create order items
        // Create order items with product lookup
        // Create order items with product lookup
        const items = await Promise.all(data.items.map(async (item: any) => {
            const cleanSku = item.seller_sku.trim()

            // Lookup product directly from table
            const { data: matchedProduct } = await supabase
                .from('products')
                .select('id, product_name, seller_account1, seller_account2, seller_account3, seller_account4, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_id')
                .or(`seller_sku1.eq.${cleanSku},seller_sku2.eq.${cleanSku},seller_sku3.eq.${cleanSku},seller_sku4.eq.${cleanSku}`)
                .eq('is_deleted', false)
                .single()

            // Determine correct seller account
            let sellerAccount = null
            if (matchedProduct) {
                if (matchedProduct.seller_sku1 === cleanSku) sellerAccount = matchedProduct.seller_account1
                else if (matchedProduct.seller_sku2 === cleanSku) sellerAccount = matchedProduct.seller_account2
                else if (matchedProduct.seller_sku3 === cleanSku) sellerAccount = matchedProduct.seller_account3
                else if (matchedProduct.seller_sku4 === cleanSku) sellerAccount = matchedProduct.seller_account4
            }

            return {
                order_id: order.id,
                seller_sku: cleanSku,
                quantity: item.quantity,
                amount: item.amount,
                item_sequence: item.item_sequence,
                seller_account: sellerAccount || null,
                product_name: matchedProduct?.product_name || `Unknown Product (${cleanSku})`,
                product_id: matchedProduct?.id || null // Link UUID correctly
            }
        }))

        const { error: itemsError } = await supabase
            .from('daraz_order_items')
            .insert(items)

        if (itemsError) throw itemsError

        revalidatePath('/dashboard/sales/daraz')
        return { success: true, order }
    } catch (error: any) {
        console.error('Error creating Daraz order:', error)
        throw new Error(error.message || 'Failed to create order')
    }
}

// Get Daraz orders with filters (for Sales Entry page)
export async function getDarazOrders(params: GetDarazOrdersParams) {
    const supabase = await createClient()
    const { page = 1, limit = 50, status, todayOnly = false, fiscalYearId, sellerAccount, unprintedOnly } = params

    // Strategy: Use the VIEW which already has totals and user joins
    let query = supabase
        .from('daraz_orders_with_totals')
        .select('*', { count: 'exact' })
        .or('deleted.is.null,deleted.eq.false')

    // Seller Account Filter
    // Note: 'seller_account' column is now added to the 'daraz_orders_with_totals' view via migration.
    if (sellerAccount && sellerAccount !== 'all') {
        query = query.eq('seller_account', sellerAccount)
    }

    // Fiscal Year Filter
    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (fy) query = query.gte('order_date', fy.start_date).lte('order_date', fy.end_date)
    }

    // Date/Status Logic
    if (todayOnly) {
        // Today Only logic: Pending OR Order Date is Today OR Shipped Today (via updated_at)
        const today = new Date().toISOString().split('T')[0]
        const todayStart = `${today}T00:00:00.000Z` // UTC start

        // Note: We use shipped_at for "Shipped" status to avoid re-appearing on random updates (like printing).
        // Logic: Show ALL Pending, Packed, Ready to Ship + Orders from Today (Created) + Shipped Today (by shipped_at)
        query = query.or(`order_status.eq.Pending,order_status.eq.Packed,order_status.eq."Ready to Ship",order_date.eq.${today},and(order_status.eq.Shipped,shipped_at.gte.${todayStart})`)
    }

    if (status && status !== 'all') query = query.eq('order_status', status)

    // Unprinted Filter
    if (unprintedOnly) {
        query = query.or('is_printed.is.null,is_printed.eq.false')
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
        .order('daraz_created_at', { ascending: false, nullsFirst: false }) // Primary: Real Daraz Time
        .order('created_at', { ascending: false }) // Fallback: DB Insert Time
        .range(from, to)

    if (error) throw error

    // Transform and Aggegrate
    // Fetch items for these orders to get statuses
    const orderIds = data?.map((o: any) => o.id) || []
    const { data: allItems } = await supabase
        .from('daraz_order_items')
        .select('order_id, item_status, quantity, product_id, product_name')
        .in('order_id', orderIds)

    const orders = data?.map((order: any) => {
        const orderItems = allItems?.filter((i: any) => i.order_id === order.id) || []

        // Calculate item statuses - use item_status if set, otherwise fallback to main order status
        // We create an array representing each unit? Or each line item?
        // User screenshot implies line items or maybe exploded units.
        // Let's stick to line items statuses for now as that's what we have.
        // If an item has qty 2, it's one line. But if split, it becomes 2 lines.
        // So mapping orderItems is correct.
        // Calculate item statuses - use item_status if set, otherwise fallback to main order status
        // Expand based on item quantity to show one status badge per unit
        const itemStatuses: string[] = []
        orderItems.forEach((i: any) => {
            const status = i.item_status || order.order_status
            const qty = i.quantity || 1
            for (let k = 0; k < qty; k++) {
                itemStatuses.push(status)
            }
        })

        return {
            ...order,
            items: orderItems,
            item_statuses: itemStatuses
        }
    }) || []

    return {
        orders,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    }
}

// Get all Daraz orders (for Order List page)
export async function getAllDarazOrders(params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    fromDate?: string
    toDate?: string
    fiscalYearId?: string
    timestampField?: string // New: which timestamp field to filter by
    sellerAccount?: string // New: filter by seller account
    ignoreStatusFilter?: boolean // New: for Status Sync to show ALL orders
}) {
    const supabase = await createClient()
    const { page = 1, limit = 50, search, status, fromDate, toDate, fiscalYearId, timestampField = 'order_date', sellerAccount, ignoreStatusFilter } = params



    let query = supabase
        .from('daraz_orders_with_totals')
        .select('*', { count: 'exact' })
        .or('deleted.is.null,deleted.eq.false') // Show only non-deleted orders

    // Filter Logic: Hide "Cancel" orders UNLESS they are printed
    // We construct a filter that says: status is NOT Cancel OR (status IS Cancel AND printed is true)
    // The database column is 'is_printed' (covers both invoice/awb printing status)
    // Logic: (order_status.neq.Cancel, is_printed.eq.true)
    // UNLESS ignoreStatusFilter is true (for Status Sync page)
    if (!ignoreStatusFilter) {
        if (!status || status === 'all') {
            query = query.or('order_status.neq.Cancel,is_printed.eq.true')
        }
    }

    if (status && status !== 'all') {
        // Match either the main status OR if the statuses array (if exists) contains the status
        // Using raw PostgREST syntax string for mixed logic
        query = query.or(`order_status.eq."${status}",statuses.cs.{${status}}`)
    }

    if (sellerAccount && sellerAccount !== 'all') {
        query = query.eq('seller_account', sellerAccount)
    }

    // Search Logic
    if (search && search.trim()) {
        const term = search.trim()
        // Complex Search: Order details OR Related Items Product Name
        // We use !inner join to filter parents by child matches for product name
        // OR standard column matches for order/tracking/customer
        // Note: OR logic across tables is tricky in PostgREST (order.id=... OR items.name=...).
        // Simplest valid approach:
        // Use an RPC or a dedicated text search index/function would be best, but here we can try:
        // Filter where (Order Number ILIKE term) OR (Tracking Number ILIKE term) OR (Customer ILIKE term) ...
        // For Product Name, we need to inspect the items.
        // PostgREST doesn't easily support "Parent Column OR Child Column".
        // Strategy: We will search main columns. If the user wants product, we might need a separate check or RPC.
        // HOWEVER, let's try to map the view's potential fields or just stick to the main ones first, 
        // OR try the text search approach if implemented.
        // Given Supabase limitations on mixed ORs, we'll try a comprehensive OR filter on the main table columns first.
        // To search Product Name, we'll use the 'order_items' relationship filter if possible, but that restricts to ONLY matching orders.
        // If we want "OR", we can't easily do (sku.eq.1 OR items.sku.eq.1).
        // Use a heuristic: If the search looks like an Order ID (digits), search Order ID.
        // If it looks like text, search Customer/Product?

        // Actually, let's use the 'or' filter string with embedded relations if supported, or just the main columns.
        // The user specifically asked for "order number, tracking number AND product name".
        // Let's rely on `daraz_order_items` lookup separate or use a subquery approach?
        // Easier: Search strictly on the main table columns for now. If product search is critical, we might need an RPC `search_orders(term)`.

        // Let's add the basic fields first as requested.
        // Note: `product_names` text array column might exist in the view? If not, we can't search it easily without RPC.
        // Checking schema mentally... we don't have product names in `daraz_orders_with_totals` usually. 
        // Let's implement Order Number, Tracking, Customer Name.

        const searchFilter = `order_number.ilike.%${term}%,tracking_number.ilike.%${term}%,customer_name.ilike.%${term}%,first_product_name.ilike.%${term}%`
        query = query.or(searchFilter)
    }

    // Fiscal Year Filter (takes precedence over fromDate/toDate)
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
    } else {
        // Date range filter using the selected timestamp field
        if (fromDate) {
            query = query.gte(timestampField, fromDate)
        }
        if (toDate) {
            query = query.lte(timestampField, toDate)
        }
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) throw error



    // Enrich orders with product_id from the first item (Optimized: Single Query)
    const orderIds = (data || []).map((o: any) => o.id)

    // Fetch all items for these orders in one go
    // We only need the first item per order for the display, but to replicate "limit(1)" logic per order in SQL is hard without lateral joins.
    // Simpler efficient approach: Fetch all items for these orders, filtering to sequence 1 if possible or just sorting.
    // Since we only need the "first" item, we can fetch items where item_sequence = 1 (assuming it starts at 1) OR fetch all and pick.
    // Fetching all is safer if sequences are messy.
    const { data: allItems } = await supabase
        .from('daraz_order_items')
        .select(`
            order_id,
            item_sequence,
            product_id,
            product_name,
            item_status,
            quantity,
            product:products(product_id)
        `)
        .in('order_id', orderIds)
        .order('item_sequence') // Ensure we can pick the first one deterministically

    // Group items by order_id
    const itemsMap = new Map()
    if (allItems) {
        for (const item of allItems) {
            if (!itemsMap.has(item.order_id)) {
                itemsMap.set(item.order_id, item) // Set the first one we find (due to sort order)
            }
        }
    }

    const enrichedOrders = (data || []).map((order: any) => {
        const firstItem = itemsMap.get(order.id)

        // Calculate item statuses for this order
        // Calculate item statuses for this order
        const orderItems = allItems?.filter((i: any) => i.order_id === order.id) || []

        // Expand statuses based on quantity
        const itemStatuses: string[] = []
        orderItems.forEach((i: any) => {
            const status = i.item_status || order.order_status
            const qty = i.quantity || 1
            for (let k = 0; k < qty; k++) {
                itemStatuses.push(status)
            }
        })

        return {
            ...order,
            product_name: firstItem?.product_name || 'N/A',
            first_product_code: (firstItem?.product as any)?.product_id || null,
            item_statuses: itemStatuses
        }
    })

    return {
        orders: enrichedOrders,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    }
}

// Get single order by ID with items
export async function getDarazOrderById(orderId: string) {
    const supabase = await createClient()

    const { data: order, error: orderError } = await supabase
        .from('daraz_orders_with_totals')
        .select('*')
        .eq('id', orderId)
        .single()

    if (orderError) throw orderError

    const { data: items, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select('*, product:products(product_id)')
        .eq('order_id', orderId)
        .order('item_sequence')

    if (itemsError) throw itemsError

    if (itemsError) throw itemsError

    // Fetch Store Details for Invoice
    let storeDetails = null
    // Use the seller_account from the first item directly, as it's more reliable than product linkage
    const sellerAccount = items.length > 0 ? items[0].seller_account : null

    if (sellerAccount) {
        const { data: store } = await supabase
            .from('online_stores')
            .select('company_name, address, contact, pan_vat_number')
            .eq('seller_account', sellerAccount)
            .single()

        if (store) {
            storeDetails = store
        }
    }

    return { ...order, items, store: storeDetails }
}

// Update order
export async function updateDarazOrder(orderId: string, data: Partial<CreateDarazOrderData>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        // Fetch user details for audit logging
        const { data: userData } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', user.id)
            .single()

        const userName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : user.user_metadata?.full_name || 'Admin'
        const userEmail = userData?.email || user.email
        const now = new Date().toISOString()

        // Prepare base update payload
        const updates: any = {
            order_number: data.order_number,
            tracking_number: data.tracking_number,
            customer_name: data.customer_name,
            order_date: data.order_date,
            order_status: data.order_status,
            remarks: data.remarks,
            edit_by: user.id,
            edited_by_name: userName,
            edited_by_email: userEmail,
            edited_at: now
        }

        // Add status-specific audit columns if status is changed manually
        if (data.order_status === 'Delivered') {
            updates.delivered_by = user.id
            updates.delivered_at = now
        } else if (data.order_status === 'Returned Delivered') {
            updates.returned_delivered_by = user.id
            updates.returned_delivered_by_name = userName
            updates.returned_delivered_by_email = userEmail
            updates.returned_delivered_at = now
        } else if (data.order_status === 'Shipped') {
            updates.shipped_by = user.id
            updates.shipped_at = now
        } else if (data.order_status === 'Returning to Seller') {
            updates.returning_to_seller_by = user.id
            updates.returning_to_seller_by_name = userName
            updates.returning_to_seller_by_email = userEmail
            updates.returning_to_seller_at = now
        } else if (data.order_status === 'Cancel' || data.order_status === 'Cancelled') {
            updates.cancelled_by = user.id
            updates.cancelled_by_name = userName
            updates.cancelled_by_email = userEmail
            updates.cancelled_at = now
        }

        // Update order
        const { error: orderError } = await supabase
            .from('daraz_orders')
            .update(updates)
            .eq('id', orderId)

        if (orderError) {
            throw orderError
        }

        // Update items if provided
        if (data.items) {
            // Delete existing items
            await supabase
                .from('daraz_order_items')
                .delete()
                .eq('order_id', orderId)

            // Insert new items
            const items = data.items.map(item => ({
                order_id: orderId,
                seller_sku: item.seller_sku,
                quantity: item.quantity,
                amount: item.amount,
                item_sequence: item.item_sequence
            }))

            const { error: itemsError } = await supabase
                .from('daraz_order_items')
                .insert(items)

            if (itemsError) throw itemsError
        }

        revalidatePath('/dashboard/sales/daraz')
        return { success: true }
    } catch (error: any) {
        console.error('Error updating order:', error)
        throw new Error(error.message || 'Failed to update order')
    }
}

// Update order status (bulk or single)
export async function updateDarazOrderStatus(orderIds: string[], newStatus: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Fetch user details (name/email) for audit logging
    const { data: userData } = await supabase
        .from('profiles') // Assuming 'profiles' or similar table, OR just use metadata
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single()

    // Fallback to auth metadata if profile fetch fails or table differs
    const userName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : user.user_metadata?.full_name || 'Admin'
    const userEmail = userData?.email || user.email

    // Prepare update payload based on status
    const updates: any = {
        order_status: newStatus === 'Cancelled' ? 'Cancel' : newStatus, // Normalize 'Cancelled' to 'Cancel' for DB Constraint
        updated_by: user.id
    }

    // Explicitly set the audit columns for the NEW status
    const now = new Date().toISOString()

    if (newStatus === 'Failed Delivered') {
        updates.fail_delivered_by = user.id
        updates.fail_delivered_by_name = userName
        updates.fail_delivered_by_email = userEmail
        updates.failed_delivered_at = now
    }
    else if (newStatus === 'Returning To Seller' || newStatus === 'Returning to Seller') {
        updates.returning_to_seller_by = user.id
        updates.returning_to_seller_by_name = userName
        updates.returning_to_seller_by_email = userEmail
        updates.returning_to_seller_at = now
    }
    else if (newStatus === 'Delivery Failed') {
        updates.delivery_failed_by = user.id
        updates.delivery_failed_by_name = userName
        updates.delivery_failed_by_email = userEmail
        updates.delivery_failed_at = now
    }
    else if (newStatus === 'Customer Return') {
        updates.customer_return_by = user.id
        updates.customer_return_by_name = userName
        updates.customer_return_by_email = userEmail
        updates.customer_return_at = now
    }
    else if (newStatus === 'Customer Return Delivered') {
        updates.customer_return_delivered_by = user.id
        updates.customer_return_delivered_by_name = userName
        updates.customer_return_delivered_by_email = userEmail
        updates.customer_return_delivered_at = now
    }
    else if (newStatus === 'Returned Delivered') {
        updates.returned_delivered_by = user.id
        updates.returned_delivered_by_name = userName
        updates.returned_delivered_by_email = userEmail
        updates.returned_delivered_at = now
    }
    else if (newStatus === 'Cancel' || newStatus === 'Cancelled') {
        updates.cancelled_by = user.id
        updates.cancelled_by_name = userName
        updates.cancelled_by_email = userEmail
        updates.cancelled_at = now
    }
    else if (newStatus === 'Shipped') {
        updates.shipped_by = user.id
        updates.shipped_at = now
    }
    else if (newStatus === 'Delivered') {
        updates.delivered_by = user.id
        updates.delivered_at = now
    }

    const { error } = await supabase
        .from('daraz_orders')
        .update(updates)
        .in('id', orderIds)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz')
    return { success: true, count: orderIds.length }
}

// Mark orders as printed
export async function markDarazOrdersAsPrinted(orderIds: string[]) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('daraz_orders')
        .update({
            is_printed: true,
            printed_at: new Date().toISOString()
        })
        .in('id', orderIds)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz')
    return { success: true }
}

// Delete order
export async function deleteDarazOrder(orderId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('daraz_orders')
        .delete()
        .eq('id', orderId)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz')
    return { success: true }
}

// Export orders to CSV
export async function exportDarazOrders(filters?: {
    status?: string
    dateFrom?: string
    dateTo?: string
}) {
    const supabase = await createClient()

    let query = supabase
        .from('daraz_orders_with_totals')
        .select('*')

    if (filters?.status && filters.status !== 'all') {
        query = query.eq('order_status', filters.status)
    }

    if (filters?.dateFrom) {
        query = query.gte('order_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
        query = query.lte('order_date', filters.dateTo)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return data || []
}
// Bulk import Daraz orders from CSV
export async function bulkImportDarazOrders(rows: any[]) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let successCount = 0
    const failures: { row: number; reason: string }[] = []

    try {
        // 1. Fetch all products for SKU matching (Optimized: Single query)
        // We fetch id, product_name, seller_account, and all SKU fields
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, product_id, product_name, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4')

        if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)

        // 2. Fetch existing order numbers (including deleted ones) to handle restore
        const orderNumbers = rows.map(r => r['Order Number']).filter(Boolean)
        const { data: existingOrders, error: existingOrdersError } = await supabase
            .from('daraz_orders')
            .select('id, order_number, deleted')
            .in('order_number', orderNumbers)

        if (existingOrdersError) throw new Error(`Failed to check existing orders: ${existingOrdersError.message}`)

        const existingOrderMap = new Map(existingOrders?.map(o => [o.order_number, o]))

        // 3. Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 1 // 1-based index for user feedback

            // Basic Validation
            const orderNumber = row['Order Number']?.toString().trim()
            const trackingNumber = row['Tracking Number']?.toString().trim()
            const customerName = row['Customer Name']?.toString().trim()
            const sellerSku = row['Seller Skus']?.toString().trim()
            // Remove commas before parsing to handle formatted numbers like "2,399.00"
            const quantity = parseInt(row['Quantity']?.toString().replace(/,/g, '') || '0')
            const amount = parseFloat(row['Amount']?.toString().replace(/,/g, '') || '0')

            if (!orderNumber || !trackingNumber || !customerName) {
                failures.push({ row: rowNum, reason: 'Missing required fields (Order#, Tracking#, or Customer)' })
                continue
            }

            const existingOrder = existingOrderMap.get(orderNumber)
            // If exists and NOT deleted, skip as duplicate
            if (existingOrder && !existingOrder.deleted) {
                failures.push({ row: rowNum, reason: `Order ${orderNumber} already exists` })
                continue
            }

            // Find Product by SKU and determine Seller Account
            let matchedProduct: any = null
            let matchedSellerAccount: string | null = null

            if (products) {
                // Find matching product
                matchedProduct = products.find(p =>
                    p.seller_sku1 === sellerSku ||
                    p.seller_sku2 === sellerSku ||
                    p.seller_sku3 === sellerSku ||
                    p.seller_sku4 === sellerSku
                )

                // If found, determine which account matched
                if (matchedProduct) {
                    if (matchedProduct.seller_sku1 === sellerSku) matchedSellerAccount = matchedProduct.seller_account1
                    else if (matchedProduct.seller_sku2 === sellerSku) matchedSellerAccount = matchedProduct.seller_account2
                    else if (matchedProduct.seller_sku3 === sellerSku) matchedSellerAccount = matchedProduct.seller_account3
                    else if (matchedProduct.seller_sku4 === sellerSku) matchedSellerAccount = matchedProduct.seller_account4
                }
            }

            // Generate Invoice Number
            const { data: invoiceData, error: invoiceError } = await supabase
                .rpc('generate_daraz_invoice_number')

            if (invoiceError) {
                failures.push({ row: rowNum, reason: `Invoice gen failed: ${invoiceError.message}` })
                continue
            }

            // Create or Restore Order
            const today = new Date().toISOString().split('T')[0]
            let orderId = ''

            if (existingOrder && existingOrder.deleted) {
                // RESTORE deleted order
                // We update it with new CSV data and clear deleted flag
                const { data: restored, error: restoreError } = await supabase
                    .from('daraz_orders')
                    .update({
                        invoice_number: invoiceData, // maintain new invoice or keep old? Usually new import = new invoice logic, let's update.
                        tracking_number: trackingNumber,
                        customer_name: customerName,
                        order_date: today,
                        order_status: 'Pending',
                        created_by: user.id, // reset creator or keep? reset to importer usually.
                        order_source: 'manual',
                        import_source: 'csv', // mark as csv import
                        remarks: 'Restored via CSV Import',
                        deleted: false,
                        deleted_at: null,
                        deleted_by: null,
                        pending_deletion: false
                    })
                    .eq('id', existingOrder.id)
                    .select()
                    .single()

                if (restoreError) {
                    failures.push({ row: rowNum, reason: `Order restore failed: ${restoreError.message}` })
                    continue
                }
                orderId = restored.id

                // Delete OLD items to replace with NEW CSV items
                await supabase.from('daraz_order_items').delete().eq('order_id', orderId)

            } else {
                // CREATE new order
                const { data: order, error: orderError } = await supabase
                    .from('daraz_orders')
                    .insert({
                        invoice_number: invoiceData,
                        order_number: orderNumber,
                        tracking_number: trackingNumber,
                        customer_name: customerName,
                        order_date: today,
                        order_status: 'Pending',
                        created_by: user.id,
                        order_source: 'manual',
                        import_source: 'csv',
                        remarks: ''
                    })
                    .select()
                    .single()

                if (orderError) {
                    failures.push({ row: rowNum, reason: `Order insert failed: ${orderError.message}` })
                    continue
                }
                orderId = order.id
            }

            // Create Order Item
            const { error: itemError } = await supabase
                .from('daraz_order_items')
                .insert({
                    order_id: orderId,
                    seller_sku: sellerSku,
                    product_id: matchedProduct?.id || null, // Optional link if we want, but schema might not strictly enforce FK if we allow 'Product Not Found'
                    quantity: quantity,
                    amount: amount, // Rate
                    item_sequence: 1,
                    seller_account: matchedSellerAccount,
                    product_name: matchedProduct?.product_name || null
                })

            if (itemError) {
                // Cleanup order if item fails? Supabase doesn't support easy nested transactions in REST.
                // We'll leave the order (it will have 0 items, visibly "Empty"). 
                // Or try to delete it.
                // Cleanup
                if (!existingOrder) {
                    await supabase.from('daraz_orders').delete().eq('id', orderId)
                }
                // If restored, we might have left it empty items which is bad, but better than deleting the header? 
                // Restore logic is tricky rollback. Let's assume failures are rare post-header.
                failures.push({ row: rowNum, reason: `Item insert failed: ${itemError.message}` })
                continue
            }

            successCount++
            // Add to existing set to prevent duplicates WITHIN the CSV
            // Add to existing map to prevent duplicates WITHIN the CSV
            existingOrderMap.set(orderNumber, { id: orderId, order_number: orderNumber, deleted: false })
        }

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        revalidatePath('/dashboard/sales/daraz/order-list')

        return { success: successCount, failures: failures }

    } catch (error: any) {
        console.error('Bulk import error:', error)
        throw new Error(error.message || 'Failed to process import')
    }
}

// ===========================================================
// FISCAL YEAR ACTIONS
// ===========================================================

// Get active fiscal year
export async function getActiveFiscalYear() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('is_active', true)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
}

// Get all fiscal years
export async function getAllFiscalYears() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .order('start_date', { ascending: false })

    if (error) throw error
    return data || []
}

// Get fiscal year by ID
export async function getFiscalYearById(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

// Get sales summary by fiscal year (Scaled for large datasets)
export async function getDarazSalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date, name')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) {
            console.error('Fiscal year error:', fyError)
            return {
                fiscalYear: 'Unknown',
                totalOrders: 0,
                totalQuantity: 0,
                totalAmount: 0,
                activeSellerAccounts: 0
            }
        }

        let totalOrders = 0
        let totalQuantity = 0
        let totalAmount = 0
        const sellerAccounts = new Set<string>()

        let page = 0
        const pageSize = 1000

        while (true) {
            const { data, error } = await supabase
                .from('daraz_orders')
                .select(`
                    id,
                    order_status,
                    items:daraz_order_items(
                        quantity,
                        amount,
                        seller_account
                    )
                `)
                .gte('order_date', fiscalYear.start_date)
                .lte('order_date', fiscalYear.end_date)
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (error) {
                console.error('Orders query error:', error)
                break
            }

            if (!data || data.length === 0) break

            const orders = data
            totalOrders += orders.length

            orders.forEach(order => {
                // Sum items for this order
                const orderQty = order.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0
                const orderAmt = order.items?.reduce((itemSum: number, item: any) => itemSum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0

                totalQuantity += orderQty
                totalAmount += orderAmt

                // Collect seller accounts
                order.items?.forEach((item: any) => {
                    if (item.seller_account) sellerAccounts.add(item.seller_account)
                })
            })

            if (data.length < pageSize) break
            page++
        }

        return {
            fiscalYear: fiscalYear.name,
            totalOrders,
            totalQuantity,
            totalAmount,
            activeSellerAccounts: sellerAccounts.size
        }
    } catch (error: any) {
        console.error('getDarazSalesByFiscal error:', error)
        return {
            fiscalYear: 'Error',
            totalOrders: 0,
            totalQuantity: 0,
            totalAmount: 0,
            activeSellerAccounts: 0
        }
    }
}

// Get monthly sales breakdown by fiscal year (Scaled)
export async function getMonthlySalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) {
            console.error('Fiscal year error in monthly:', fyError)
            return []
        }

        const monthlyData: { [key: string]: { count: number, total: number } } = {}
        let page = 0
        const pageSize = 1000

        while (true) {
            const { data, error } = await supabase
                .from('daraz_orders')
                .select(`
                    order_date,
                    items:daraz_order_items(
                        quantity,
                        amount
                    )
                `)
                .gte('order_date', fiscalYear.start_date)
                .lte('order_date', fiscalYear.end_date)
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (error) {
                console.error('Monthly orders error:', error)
                break
            }

            if (!data || data.length === 0) break

            data.forEach(order => {
                const month = new Date(order.order_date).toISOString().substring(0, 7) // YYYY-MM
                if (!monthlyData[month]) {
                    monthlyData[month] = { count: 0, total: 0 }
                }
                monthlyData[month].count++
                // Calculate total from items
                const orderTotal = order.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0
                monthlyData[month].total += orderTotal
            })

            if (data.length < pageSize) break
            page++
        }

        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month,
                orderCount: data.count,
                totalAmount: data.total
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
    } catch (error: any) {
        console.error('getMonthlySalesByFiscalYear error:', error)
        return []
    }
}

// Get sales by seller account for fiscal year (Scaled)
export async function getSalesBySellerAccount(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) {
            console.error('Fiscal year error:', fyError)
            return []
        }

        const accountData: { [key: string]: { orders: number, quantity: number, totalAmount: number } } = {}
        let page = 0
        const pageSize = 1000

        while (true) {
            const { data, error } = await supabase
                .from('daraz_orders')
                .select(`
                    items:daraz_order_items(
                        seller_account,
                        product_name,
                        quantity,
                        amount
                    )
                `)
                .gte('order_date', fiscalYear.start_date)
                .lte('order_date', fiscalYear.end_date)
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (error) {
                console.error('Seller sales error:', error)
                break
            }

            if (!data || data.length === 0) break

            data.forEach(order => {
                order.items?.forEach((item: any) => {
                    const account = item.seller_account || 'Unknown'
                    if (!accountData[account]) {
                        accountData[account] = { orders: 0, quantity: 0, totalAmount: 0 }
                    }
                    accountData[account].orders++
                    accountData[account].quantity += item.quantity || 0
                    accountData[account].totalAmount += (item.quantity || 0) * (item.amount || 0)
                })
            })

            if (data.length < pageSize) break
            page++
        }

        // Fetch company names from online_stores
        const { data: stores } = await supabase
            .from('online_stores')
            .select('seller_account, company_name')

        const storeMap = new Map(stores?.map(s => [s.seller_account, s.company_name]) || [])

        return Object.entries(accountData).map(([account, data]) => ({
            sellerAccount: account,
            companyName: storeMap.get(account) || account,
            orders: data.orders,
            quantity: data.quantity,
            totalAmount: data.totalAmount
        }))
    } catch (error: any) {
        console.error('getSalesBySellerAccount error:', error)
        return []
    }
}

// Get stats for status summary
export async function getDarazOrderStats(sellerAccount?: string, restrictShippedToToday?: boolean) {
    const supabase = await createClient()

    try {
        // Build base query
        const getQuery = (status: string, dateRestricted = false) => {
            let query = supabase
                .from('daraz_orders')
                .select('*, items:daraz_order_items!inner(seller_account)', { count: 'exact', head: true })
                .or('deleted.is.null,deleted.eq.false')
                .ilike('order_status', status)

            if (sellerAccount && sellerAccount !== 'all') {
                query = query.eq('items.seller_account', sellerAccount)
            }

            if (dateRestricted && restrictShippedToToday) {
                const today = new Date().toISOString().split('T')[0]
                const todayStart = `${today}T00:00:00.000Z`
                // Match logic in getDarazOrders: Shipped Today means shipped_at >= Today 00:00
                query = query.gte('shipped_at', todayStart)
            }

            return query
        }

        const [pending, packed, readyToShip, shipped] = await Promise.all([
            getQuery('Pending'),
            getQuery('Packed'),
            getQuery('Ready to Ship'),
            getQuery('Shipped', true) // Apply date restriction to Shipped only
        ])

        return {
            pending: pending.count || 0,
            packed: packed.count || 0,
            readyToShip: readyToShip.count || 0,
            shipped: shipped.count || 0
        }
    } catch (error) {
        console.error('Error fetching stats:', error)
        return { pending: 0, shipped: 0 }
    }
}

// Get Daily Sales Report - aggregated by date and seller account
export async function getDailySalesReport() {
    const supabase = await createClient()

    try {
        // Fetch all non-deleted orders with relevant statuses using BATCH FETCHING
        let allOrders: any[] = []
        let page = 0
        const pageSize = 1000

        while (true) {
            const from = page * pageSize
            const to = from + pageSize - 1

            const { data: orders, error } = await supabase
                .from('daraz_orders')
                .select(`
                    id,
                    order_id,
                    order_number,
                    store_id,
                    order_status,
                    order_date,
                    price,
                    updated_at,
                    shipped_at,
                    delivered_at,
                    online_stores!inner(seller_account)
                `)
                .eq('deleted', false)
                .in('order_status', ['Shipped', 'Delivered', 'Returning to Seller', 'Returned Delivered', 'Customer Return', 'Customer Return Delivered'])
                .order('updated_at', { ascending: false })
                .range(from, to)

            if (error) throw error

            if (!orders || orders.length === 0) break

            allOrders = allOrders.concat(orders)

            // If we got less than pageSize, we've reached the end
            if (orders.length < pageSize) break

            page++
        }

        // Group by date and seller account
        const reportMap = new Map<string, Map<string, {
            shipped_qty: number
            shipped_amount: number
            delivered_qty: number
            delivered_amount: number
            returning_to_seller_qty: number
            returned_delivered_qty: number
            return_qty: number
            customer_return_delivered_qty: number
        }>>()

        const getStats = (dateStr: string, sellerAccount: string) => {
            if (!reportMap.has(dateStr)) {
                reportMap.set(dateStr, new Map())
            }

            const dateMap = reportMap.get(dateStr)!
            if (!dateMap.has(sellerAccount)) {
                dateMap.set(sellerAccount, {
                    shipped_qty: 0,
                    shipped_amount: 0,
                    delivered_qty: 0,
                    delivered_amount: 0,
                    returning_to_seller_qty: 0,
                    returned_delivered_qty: 0,
                    return_qty: 0,
                    customer_return_delivered_qty: 0
                })
            }
            return dateMap.get(sellerAccount)!
        }

        allOrders?.forEach((order: any) => {
            const sellerAccount = order.online_stores?.seller_account || 'Unknown'
            const price = parseFloat(order.price) || 0

            // 1. Handle Shipped Metric (independent check)
            // Use shipped_at timestamp if available
            if (order.shipped_at) {
                const shippedDate = new Date(order.shipped_at).toISOString().split('T')[0]
                const stats = getStats(shippedDate, sellerAccount)
                stats.shipped_qty++
                stats.shipped_amount += price
            } else if (order.order_status === 'Shipped') {
                // Fallback: If status is 'Shipped' but no shipped_at (legacy?), use updated_at
                const dateStr = new Date(order.updated_at).toISOString().split('T')[0]
                const stats = getStats(dateStr, sellerAccount)
                stats.shipped_qty++
                stats.shipped_amount += price
            }

            // 2. Handle Delivered Metric (independent check)
            // Use delivered_at timestamp if available
            if (order.delivered_at) {
                const deliveredDate = new Date(order.delivered_at).toISOString().split('T')[0]
                const stats = getStats(deliveredDate, sellerAccount)
                stats.delivered_qty++
                stats.delivered_amount += price
            }

            // 3. Handle Other Statuses (based on current status & updated_at)
            const dateStr = new Date(order.updated_at).toISOString().split('T')[0]
            const stats = getStats(dateStr, sellerAccount)

            switch (order.order_status) {
                // Note: We do NOT count 'Shipped' here via updated_at, handled above.
                // Note: We do NOT count 'Delivered' here either if using delivered_at logic
                // For now, if delivered_at is present, we skip the switch case for 'Delivered'
                // to avoid double counting or using the wrong date.

                case 'Delivered':
                    // Only count via status if no delivered_at exists (legacy fallback)
                    if (!order.delivered_at) {
                        stats.delivered_qty++
                        stats.delivered_amount += price
                    }
                    break
                case 'Returning to Seller':
                    stats.returning_to_seller_qty++
                    break
                case 'Returned Delivered':
                    stats.returned_delivered_qty++
                    break
                case 'Customer Return':
                    stats.return_qty++
                    break
                case 'Customer Return Delivered':
                    stats.customer_return_delivered_qty++
                    break
            }
        })

        // Convert to array format, sorted by date descending
        const result: Array<{
            date: string
            seller_account: string
            shipped_qty: number
            shipped_amount: number
            delivered_qty: number
            delivered_amount: number
            returning_to_seller_qty: number
            returned_delivered_qty: number
            return_qty: number
            customer_return_delivered_qty: number
        }> = []

        const sortedDates = Array.from(reportMap.keys()).sort((a, b) => b.localeCompare(a))

        sortedDates.forEach(date => {
            const dateMap = reportMap.get(date)!
            dateMap.forEach((stats, sellerAccount) => {
                result.push({
                    date,
                    seller_account: sellerAccount,
                    ...stats
                })
            })
        })

        return result
    } catch (error) {
        console.error('Error fetching daily sales report:', error)
        return []
    }
}

// Get Order Summary Report - aggregated by seller account
// Get Order Summary Report - aggregated by seller account
export async function getOrderSummaryReport() {
    const supabase = await createClient()

    try {
        // 1. Get ALL Seller Accounts
        const { data: stores, error: storeError } = await supabase
            .from('online_stores')
            .select('seller_account')
            .order('seller_account')

        if (storeError) throw storeError

        // Initialize map
        const summaryMap = new Map<string, {
            shipped_qty: number
            shipped_amount: number
            delivered_qty: number
            delivered_amount: number
            returning_to_seller_qty: number
            returned_delivered_qty: number
            return_qty: number
            customer_return_delivered_qty: number
            remain_qty: number
        }>()

        stores?.forEach(store => {
            if (store.seller_account) {
                summaryMap.set(store.seller_account, {
                    shipped_qty: 0,
                    shipped_amount: 0,
                    delivered_qty: 0,
                    delivered_amount: 0,
                    returning_to_seller_qty: 0,
                    returned_delivered_qty: 0,
                    return_qty: 0,
                    customer_return_delivered_qty: 0,
                    remain_qty: 0
                })
            }
        })

        // 2. Fetch ALL non-deleted orders (Removing strict status filter to catch everything)
        // We select 'statuses' array column if available, or just use order_status
        // Note: daraz_orders_with_totals view should ideally have 'statuses' array. 
        // If not, we rely on order_status. 
        // Checking previous code: getAllDarazOrders uses "statuses.cs.{...}". 
        // We assume 'statuses' column exists in standard table/view or we need to fetch it.
        // If 'statuses' is not in the view, we might miss item-level statuses. 
        // Let's safe-guard: select * or at least commonly needed columns.
        let allOrders: any[] = []
        let page = 0
        const pageSize = 1000

        while (true) {
            const from = page * pageSize
            const to = from + pageSize - 1

            const { data: orders, error } = await supabase
                .from('daraz_orders_with_totals')
                .select('order_status, price, seller_account, statuses') // Request 'statuses' array
                .or('deleted.is.null,deleted.eq.false')
                // Remove the .in() filter to get generic 'Shipped' orders that might have 'Returning' items
                .range(from, to)

            if (error) throw error

            if (!orders || orders.length === 0) break

            allOrders = allOrders.concat(orders)

            if (orders.length < pageSize) break
            page++
        }

        // 3. Aggregate Data with Hybrid Matching Priority
        allOrders?.forEach((order: any) => {
            const sellerAccount = order.seller_account || 'Unknown'
            const price = parseFloat(order.price) || 0
            const mainStatus = order.order_status
            const itemStatuses = order.statuses || [] // Array of strings

            // Helper to check if status exists in Main OR Items
            const hasStatus = (target: string) => {
                return mainStatus === target || itemStatuses.includes(target)
            }

            if (!summaryMap.has(sellerAccount)) {
                summaryMap.set(sellerAccount, {
                    shipped_qty: 0,
                    shipped_amount: 0,
                    delivered_qty: 0,
                    delivered_amount: 0,
                    returning_to_seller_qty: 0,
                    returned_delivered_qty: 0,
                    return_qty: 0,
                    customer_return_delivered_qty: 0,
                    remain_qty: 0
                })
            }

            const stats = summaryMap.get(sellerAccount)!

            // Priority Logic: Assign to ONE bucket (mutually exclusive columns) based on significance
            let assigned = false

            // 1. Customer Return Delivered
            if (hasStatus('Customer Return Delivered')) {
                stats.customer_return_delivered_qty++
                assigned = true
            }
            // 2. Customer Return
            else if (hasStatus('Customer Return')) {
                stats.return_qty++
                assigned = true
            }
            // 3. Returned Delivered
            else if (hasStatus('Returned Delivered')) {
                stats.returned_delivered_qty++
                assigned = true
            }
            // 4. Returning to Seller
            else if (hasStatus('Returning to Seller')) {
                stats.returning_to_seller_qty++
                assigned = true
            }
            // 5. Delivered
            else if (hasStatus('Delivered')) {
                stats.delivered_qty++
                // Only add amount to Delivered Amount if it's actually Delivered
                stats.delivered_amount += price
                assigned = true
            }
            // 6. Shipped (Remain) - Catch-all for "Shipped" but not yet final
            // Also explicitly check for 'Shipped' status
            else if (mainStatus === 'Shipped') {
                stats.remain_qty++
                assigned = true
            }

            // "Shipped Qty" (Total Dispatched)
            // Increment for ANY of the above categories, plus 'Ready to Ship' if we wanted, 
            // but usually this report tracks post-dispatch.
            // If it was assigned to any category OR it is 'Shipped', count it.
            // Also include 'Delivery Failed' in the Total count if we want them to appear in the grand total 
            // even if they don't have a specific column (user asked to fix discrepancies).
            // Currently, 'Delivery Failed' falls through 'assigned=false'.

            // LOGIC: If it was assigned to a bucket, OR matches generic Shipped/Failed Dispatched states
            // We want to match the "Total" of 1174 from before roughly, which included:
            // Delivered + Returning + Returned + Return + ReturnDelivered + Remain.
            // If 'Delivery Failed' was missing before, adding it to Shipped Total might increase the total vs before.
            // Let's stick to: If it's a "Dispatched" status, increment Shipped Qty/Amount.

            const dispatchedStatuses = [
                'Shipped', 'Delivered', 'Returning to Seller', 'Returned Delivered',
                'Customer Return', 'Customer Return Delivered', 'Delivery Failed',
                'Fail Delivered', 'Lost', 'Damaged'
            ]

            // Check if order is roughly "Post-Dispatch" logic
            const isDispatched = dispatchedStatuses.includes(mainStatus) || dispatchedStatuses.some(s => itemStatuses.includes(s))

            if (isDispatched) {
                stats.shipped_qty++
                stats.shipped_amount += price
            }
        })

        // 4. Convert and Sort
        return Array.from(summaryMap.entries()).map(([seller_account, stats]) => ({
            seller_account,
            ...stats
        })).sort((a, b) => a.seller_account.localeCompare(b.seller_account))

    } catch (error) {
        console.error('Error fetching order summary report:', error)
        return []
    }
}

// Sync product names and seller accounts from inventory by matching seller SKUs
export async function syncProductInfoFromInventory() {
    const supabase = await createClient()

    try {
        // Fetch ALL products in batches
        let allProducts: any[] = []
        let page = 0
        const pageSize = 1000

        while (true) {
            const { data: batchProducts, error: productsError } = await supabase
                .from('products')
                .select('id, product_name, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4')
                .eq('is_deleted', false)
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('id')

            if (productsError) throw productsError

            if (!batchProducts || batchProducts.length === 0) break

            allProducts = allProducts.concat(batchProducts)

            if (batchProducts.length < pageSize) break

            page++
            if (page >= 50) break
        }

        // Create a map of seller_sku -> { product_id, product_name, seller_account }
        const skuMap = new Map<string, { product_id: string, product_name: string, seller_account: string }>()

        allProducts.forEach(product => {
            if (product.seller_sku1) skuMap.set(product.seller_sku1.toLowerCase(), { product_id: product.id, product_name: product.product_name, seller_account: product.seller_account1 || '' })
            if (product.seller_sku2) skuMap.set(product.seller_sku2.toLowerCase(), { product_id: product.id, product_name: product.product_name, seller_account: product.seller_account2 || '' })
            if (product.seller_sku3) skuMap.set(product.seller_sku3.toLowerCase(), { product_id: product.id, product_name: product.product_name, seller_account: product.seller_account3 || '' })
            if (product.seller_sku4) skuMap.set(product.seller_sku4.toLowerCase(), { product_id: product.id, product_name: product.product_name, seller_account: product.seller_account4 || '' })
        })

        console.log('Total products loaded:', allProducts.length)
        console.log('Pages fetched:', page + 1)
        console.log('SKU map entries:', skuMap.size)
        console.log('Sample SKUs in map:', Array.from(skuMap.keys()).slice(0, 5))

        // Debug: Check if specific SKU is in map
        const testSku = '157851176-1727159543654-0'.toLowerCase()
        console.log('Looking for test SKU:', testSku)
        console.log('Is test SKU in map?', skuMap.has(testSku))
        if (skuMap.has(testSku)) {
            console.log('Test SKU value:', skuMap.get(testSku))
        }

        // Debug: Show all SKUs containing '157851176'
        const matchingSkus = Array.from(skuMap.keys()).filter(sku => sku.includes('157851176'))
        console.log('SKUs containing 157851176:', matchingSkus)

        // Get ALL active orders (not just those without invoice numbers)
        // User wants to sync product info even for already-synced orders
        const { data: orders, error: ordersError } = await supabase
            .from('daraz_orders')
            .select('id')
            .eq('deleted', false)

        if (ordersError) throw ordersError

        if (!orders || orders.length === 0) {
            return {
                success: true,
                updated: 0,
                message: 'No orders found to sync'
            }
        }

        console.log('Found orders:', orders.length)

        const orderIds = orders.map(o => o.id)
        let orderItems: any[] = []

        // Batch fetch items to avoid URI too long / Bad Request errors
        const BATCH_SIZE = 100
        for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
            const batchIds = orderIds.slice(i, i + BATCH_SIZE)
            const { data: batchItems, error: itemsError } = await supabase
                .from('daraz_order_items')
                .select('id, seller_sku, product_name, seller_account, order_id, product_id')
                .in('order_id', batchIds)

            if (itemsError) throw itemsError
            if (batchItems) orderItems = orderItems.concat(batchItems)
        }

        console.log('Found order items:', orderItems.length)
        console.log('SKU map size:', skuMap.size)

        let updatedCount = 0
        const updates: Array<{ id: string, product_name: string, seller_account: string, product_id: string }> = []

        // Find items that need updating (Check all items against inventory map)
        orderItems?.forEach((item: any) => {
            const sellerSku = item.seller_sku?.trim().toLowerCase()

            if (sellerSku && skuMap.has(sellerSku)) {
                const productInfo = skuMap.get(sellerSku)!

                // Check if update is needed (if name or account differs OR if product_id is missing/wrong)
                // Normalize strings for comparison (handle nulls/undefined)
                const currentName = (item.product_name || '').trim()
                const newName = (productInfo.product_name || '').trim()

                const currentAccount = (item.seller_account || '').trim()
                const newAccount = (productInfo.seller_account || '').trim()

                // If either Name OR Account is different OR product_id is different, we sync it
                // This covers: 1. Empty/Missing info, 2. "Product Not Found" placeholder, 3. "Unknown Product", 4. Outdated info, 5. Missing FK
                if (currentName !== newName || currentAccount !== newAccount || item.product_id !== productInfo.product_id) {
                    console.log(`Syncing item ${item.id} (${sellerSku}):`)
                    console.log(`  Name: ${currentName} -> ${newName}`)
                    console.log(`  Account: ${currentAccount} -> ${newAccount}`)
                    console.log(`  ID: ${item.product_id} -> ${productInfo.product_id}`)

                    updates.push({
                        id: item.id,
                        product_name: productInfo.product_name,
                        seller_account: productInfo.seller_account,
                        product_id: productInfo.product_id
                    })
                }
            } else {
                if (sellerSku) {
                    // console.log(`No match for SKU: ${sellerSku}`) // optional log
                }
            }
        })

        console.log('Updates to perform:', updates.length)

        // Log unmatched SKUs for user to fix
        const unmatchedSkus = new Set<string>()
        orderItems?.forEach((item: any) => {
            const name = (item.product_name || '').trim()
            const needsSync = !name ||
                name === '' ||
                name === 'Product Not Found' ||
                name.startsWith('Unknown Product')

            if (needsSync) {
                const sellerSku = item.seller_sku?.trim().toLowerCase()
                if (sellerSku && !skuMap.has(sellerSku)) {
                    unmatchedSkus.add(item.seller_sku) // Keep original case
                }
            }
        })

        if (unmatchedSkus.size > 0) {
            console.log('=====================================')
            console.log('UNMATCHED SKUs - Add these to Product List:')
            console.log('=====================================')
            Array.from(unmatchedSkus).forEach(sku => console.log(`- ${sku}`))
            console.log('=====================================')
            console.log(`Total unmatched: ${unmatchedSkus.size}`)
            console.log('Copy these SKUs and add them to your products with:')
            console.log('- Seller SKU 1, 2, 3, or 4')
            console.log('- Product Name')
            console.log('- Seller Account')
            console.log('=====================================')
        }

        // Perform batch updates
        for (const update of updates) {
            const { error } = await supabase
                .from('daraz_order_items')
                .update({
                    product_id: update.product_id, // Fix FK link
                    product_name: update.product_name,
                    seller_account: update.seller_account
                })
                .eq('id', update.id)

            if (!error) {
                updatedCount++
            }
        }

        const missingCount = unmatchedSkus.size
        let returnMessage = updatedCount > 0
            ? `Successfully synced ${updatedCount} product${updatedCount > 1 ? 's' : ''}.`
            : 'No updates performed.'

        if (missingCount > 0) {
            returnMessage += ` Found ${missingCount} SKU${missingCount > 1 ? 's' : ''} not in inventory (check logs).`
        }

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        return {
            success: true,
            updated: updatedCount,
            message: returnMessage
        }
    } catch (error) {
        console.error('Error syncing product info:', error)
        return {
            success: false,
            updated: 0,
            message: 'Failed to sync product information'
        }
    }
}
// Sync a single order's products from inventory
export async function syncDarazOrderProducts(orderId: string) {
    const supabase = await createClient()

    try {
        // 1. Fetch items for this order
        const { data: items, error: itemsError } = await supabase
            .from('daraz_order_items')
            .select('*')
            .eq('order_id', orderId)

        if (itemsError) throw itemsError
        if (!items || items.length === 0) return { success: false, message: 'No items found in this order' }

        let updatedCount = 0
        const updates: string[] = []

        // 2. Process each item (Parallelly)
        await Promise.all(items.map(async (item: any) => {
            const sellerSku = item.seller_sku?.trim()
            if (!sellerSku) return

            // Search in products table
            // We search for exact match in any of the 4 SKU columns
            // Optimized query: Use .or with simple equality
            const { data: product } = await supabase
                .from('products')
                .select('product_name, seller_account1, seller_sku1, seller_account2, seller_sku2, seller_account3, seller_sku3, seller_account4, seller_sku4')
                .or(`seller_sku1.eq."${sellerSku}",seller_sku2.eq."${sellerSku}",seller_sku3.eq."${sellerSku}",seller_sku4.eq."${sellerSku}"`)
                .eq('is_deleted', false)
                .maybeSingle() // Use maybeSingle to avoid error if not found

            if (product) {
                // Determine which account matches
                let matchedAccount = ''
                if (product.seller_sku1 === sellerSku) matchedAccount = product.seller_account1
                else if (product.seller_sku2 === sellerSku) matchedAccount = product.seller_account2
                else if (product.seller_sku3 === sellerSku) matchedAccount = product.seller_account3
                else if (product.seller_sku4 === sellerSku) matchedAccount = product.seller_account4

                // Update item
                const { error: updateError } = await supabase
                    .from('daraz_order_items')
                    .update({
                        product_name: product.product_name,
                        seller_account: matchedAccount
                    })
                    .eq('id', item.id)

                if (!updateError) {
                    updatedCount++
                    updates.push(`${sellerSku} -> ${product.product_name}`)
                }
            } else {
                console.log(`Single Sync: SKU ${sellerSku} not found in inventory.`)
            }
        }))

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        revalidatePath('/dashboard/sales/daraz/order-list')

        return {
            success: true,
            updated: updatedCount,
            message: updatedCount > 0
                ? `Synced ${updatedCount} items: ${updates.join(', ')}`
                : 'No matching products found in inventory for these SKUs.'
        }

    } catch (error: any) {
        console.error('Error syncing order products:', error)
        return { success: false, message: error.message || 'Failed to sync products' }
    }
}

export async function getUniqueSellerAccounts() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('daraz_orders_with_totals')
        .select('seller_account')
        .not('seller_account', 'is', null)

    // return unique
    const accounts = [...new Set((data || []).map(d => d.seller_account))]
    return accounts.sort()
}

export async function getOrderStatusSummary() {
    const supabase = await createClient()

    try {
        // Get unique seller accounts
        const sellerAccounts = await getUniqueSellerAccounts()


        const statuses = ['Pending', 'Packed', 'Ready to Ship', 'Shipped', 'Delivered',
            'Returning to Seller', 'Returned Delivered', 'Customer Return',
            'Customer Return Delivered', 'Unpaid']

        const summary: any[] = []

        // For each seller account, query counts for each status using getAllDarazOrders
        for (const account of sellerAccounts) {
            const row: any = {
                seller_account: account,
                unpaid: 0,
                pending: 0,
                packed: 0,
                ready_to_ship: 0,
                shipped: 0,
                delivered: 0,
                returning_to_seller: 0,
                returned_delivered: 0,
                customer_return: 0,
                customer_return_delivered: 0
            }

            // Query each status to get exact count that matches filtered view
            // We run these in parallel for the current account to speed it up
            await Promise.all(statuses.map(async (status) => {
                const result = await getAllDarazOrders({
                    page: 1,
                    limit: 1, // We only need the count, not the data
                    status: status,
                    sellerAccount: account
                })

                const count = result.pagination.total

                // Map status to summary field
                if (status === 'Unpaid') row.unpaid = count
                else if (status === 'Pending') row.pending = count
                else if (status === 'Packed') row.packed = count
                else if (status === 'Ready to Ship') row.ready_to_ship = count
                else if (status === 'Shipped') row.shipped = count
                else if (status === 'Delivered') row.delivered = count
                else if (status === 'Returning to Seller') row.returning_to_seller = count
                else if (status === 'Returned Delivered') row.returned_delivered = count
                else if (status === 'Customer Return') row.customer_return = count
                else if (status === 'Customer Return Delivered') row.customer_return_delivered = count
            }))

            summary.push(row)
        }




        const result = summary.sort((a, b) => a.seller_account.localeCompare(b.seller_account))

        return result
    } catch (error) {
        console.error('Error in getOrderStatusSummary:', error)
        return []
    }
}

// Get sales breakdown for last 30 days (Daily Total Orders vs Seller Account)
export async function getLast30DaysSales(fiscalYearId?: string) {
    const supabase = await createClient()

    try {
        // Calculate start date (30 days ago)
        const endDateObj = new Date()
        const startDateObj = new Date()
        startDateObj.setDate(endDateObj.getDate() - 30)

        const startDate = startDateObj.toISOString().split('T')[0]
        const endDate = endDateObj.toISOString().split('T')[0] // today

        // Use batch fetching to get all relevant orders
        let page = 0
        const pageSize = 1000
        const dailyData: { [date: string]: { [seller: string]: number } } = {}
        const sellerAccounts = new Set<string>()

        while (true) {
            let query = supabase
                .from('daraz_orders')
                .select(`
                    order_date,
                    items:daraz_order_items(
                        seller_account
                    )
                `)
                .gte('order_date', startDate)
                .lte('order_date', endDate)
                .range(page * pageSize, (page + 1) * pageSize - 1)

            // If fiscal year provided, we might want to restrict, but "Last 30 Days" usually implies absolute recent time.
            // Ignoring FY for "Last 30 Days" chart as it's a recent trend view.

            const { data, error } = await query

            if (error) {
                console.error('getLast30DaysSales query error:', error)
                break
            }

            if (!data || data.length === 0) break

            data.forEach(order => {
                const date = order.order_date
                if (!dailyData[date]) {
                    dailyData[date] = {}
                }

                order.items?.forEach((item: any) => {
                    const seller = item.seller_account || 'Unknown'
                    sellerAccounts.add(seller)
                    if (!dailyData[date][seller]) {
                        dailyData[date][seller] = 0
                    }
                    dailyData[date][seller]++
                })
            })

            if (data.length < pageSize) break
            page++
        }

        // Fill in missing dates with 0
        const result: { date: string, [seller: string]: number | string }[] = []
        for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0]
            const dayData: any = { date: dateStr }

            sellerAccounts.forEach(seller => {
                dayData[seller] = dailyData[dateStr]?.[seller] || 0
            })
            result.push(dayData)
        }

        return {
            data: result,
            sellers: Array.from(sellerAccounts).sort()
        }


    } catch (error) {
        console.error('getLast30DaysSales error:', error)
        return { data: [], sellers: [] }
    }
}

// ─── Product Report Data ──────────────────────────────────────────────────────
// Aggregates order items by product + seller account:
//   • sold_qty          — units sold (excludes returned/cancelled/unpaid)
//   • delivered_qty     — units with Delivered status
//   • delivered_revenue — revenue from delivered items only
//   • delivered_profit  — calculated per-product:
//       product_revenue - product_purchase_cost - (daraz_fees × product_revenue/order_revenue)
//   • unit_profit       — delivered_profit / delivered_qty  (avg profit per unit)
//   • shipped_qty       — units currently in "Shipped" status
//   • projected_profit  — shipped_qty × unit_profit  (pipeline / in-transit estimate)

export interface ProductReportRow {
    product_name: string
    seller_sku: string
    seller_account: string
    sold_qty: number
    delivered_qty: number
    shipped_qty: number
    total_orders: number
    delivered_revenue: number
    delivered_profit: number | null     // null = no purchase cost data in profit tracker
    delivered_qty_with_cost: number
    has_profit_data: boolean
    unit_profit: number | null          // delivered_profit / delivered_qty_with_cost
    projected_profit: number | null     // unit_profit × shipped_qty
}

export interface GetProductReportParams {
    sellerAccount?: string
    dateRange?: '7' | '14' | '30' | 'custom'
    fromDate?: string
    toDate?: string
    dateType?: 'shipped' | 'delivered'
    page?: number
    limit?: number
}

// Statuses that should NOT count towards Sold Qty
const NON_SOLD_STATUSES = [
    'Returned Delivered',
    'returned delivered',
    'Customer Return Delivered',
    'customer return delivered',
    'Cancelled',
    'cancelled',
    'Cancel',
    'cancel',
    'unpaid',
    'Unpaid',
]

export async function getProductReportData(params: GetProductReportParams) {
    const supabase = await createClient()
    const {
        sellerAccount,
        dateRange,
        fromDate,
        toDate,
        dateType = 'shipped',
        page = 1,
        limit = 50,
    } = params

    // ── Date Range Resolution ──────────────────────────────────────────────────
    let resolvedFrom: string | null = null
    let resolvedTo: string | null = null

    if (dateRange && dateRange !== 'custom') {
        const days = parseInt(dateRange)
        const now = new Date()
        const from = new Date(now)
        from.setDate(from.getDate() - days)
        resolvedFrom = from.toISOString().split('T')[0]
        resolvedTo = now.toISOString().split('T')[0]
    } else if (fromDate) {
        resolvedFrom = fromDate
        resolvedTo = toDate || new Date().toISOString().split('T')[0]
    }

    // ── Step 1: Fetch all matching order items ─────────────────────────────────
    let rawItems: any[] = []
    let fetchPage = 0
    const FETCH_SIZE = 1000
    let hasMore = true

    while (hasMore) {
        const from = fetchPage * FETCH_SIZE
        const to = from + FETCH_SIZE - 1

        let pageQuery = supabase
            .from('daraz_order_items')
            .select(`
                id,
                product_name,
                seller_sku,
                seller_account,
                quantity,
                amount,
                item_status,
                purchase_cost,
                order_id,
                daraz_orders!inner(
                    id,
                    order_number,
                    order_date,
                    order_status,
                    daraz_fees,
                    deleted,
                    shipped_at,
                    delivered_by_daraz,
                    delivered_at
                )
            `)
            .not('product_name', 'is', null)
            .range(from, to)

        // Seller account filter
        if (sellerAccount && sellerAccount !== 'all' && sellerAccount !== 'All') {
            pageQuery = pageQuery.eq('seller_account', sellerAccount)
        }

        // Date filter: if dateType is delivered, check delivered_by_daraz (fallback to delivered_at)
        // If dateType is shipped, check shipped_at (fallback to order_date)
        if (resolvedFrom && resolvedTo) {
            if (dateType === 'delivered') {
                pageQuery = pageQuery.or(
                    `and(delivered_by_daraz.gte.${resolvedFrom}T00:00:00.000Z,delivered_by_daraz.lte.${resolvedTo}T23:59:59.999Z),` +
                    `and(delivered_by_daraz.is.null,delivered_at.gte.${resolvedFrom}T00:00:00.000Z,delivered_at.lte.${resolvedTo}T23:59:59.999Z)`,
                    { foreignTable: 'daraz_orders' }
                )
            } else {
                pageQuery = pageQuery.or(
                    `and(shipped_at.gte.${resolvedFrom}T00:00:00.000Z,shipped_at.lte.${resolvedTo}T23:59:59.999Z),` +
                    `and(shipped_at.is.null,order_date.gte.${resolvedFrom},order_date.lte.${resolvedTo})`,
                    { foreignTable: 'daraz_orders' }
                )
            }
        }

        const { data, error } = await pageQuery
        if (error) {
            console.error('[getProductReportData] Page fetch error:', error)
            throw new Error(error.message)
        }

        if (!data || data.length === 0) {
            hasMore = false
        } else {
            rawItems = rawItems.concat(data)
            if (data.length < FETCH_SIZE) {
                hasMore = false
            } else {
                fetchPage++
            }
        }
    }

    // Exclude deleted orders
    const items: any[] = rawItems.filter((item: any) => !item.daraz_orders?.deleted)

    // ── Step 2: Fetch all items for the delivered orders (view-independent totals) ───
    const deliveredOrderIds = Array.from(new Set(
        items
            .filter((item: any) => {
                const effectiveStatus = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
                return effectiveStatus === 'delivered'
            })
            .map((item: any) => item.daraz_orders?.id)
            .filter(Boolean)
    ))

    let allOrderItems: any[] = []
    if (deliveredOrderIds.length > 0) {
        const CHUNK_SIZE = 100
        const chunks: string[][] = []
        for (let i = 0; i < deliveredOrderIds.length; i += CHUNK_SIZE) {
            chunks.push(deliveredOrderIds.slice(i, i + CHUNK_SIZE))
        }
        const promises = chunks.map(async (chunk) => {
            const { data, error } = await supabase
                .from('daraz_order_items')
                .select('order_id, quantity, amount, purchase_cost, product_id, product_name, seller_sku')
                .in('order_id', chunk)
            if (error) {
                console.error('[getProductReportData] Error fetching order items chunk:', error)
                return []
            }
            return data || []
        })
        const results = await Promise.all(promises)
        allOrderItems = results.flat()
    }

    // ── Step 3: Fetch fallback prices for all product_ids from inventory_price_reports_view ───
    const allProductIds = Array.from(new Set([
        ...items.map((i: any) => i.product_id),
        ...allOrderItems.map((i: any) => i.product_id)
    ].filter(Boolean)))

    const priceMap: Record<string, { last_price: number, est_price: number }> = {}
    if (allProductIds.length > 0) {
        const CHUNK_SIZE = 100
        const chunks: string[][] = []
        for (let i = 0; i < allProductIds.length; i += CHUNK_SIZE) {
            chunks.push(allProductIds.slice(i, i + CHUNK_SIZE))
        }
        const promises = chunks.map(async (chunk) => {
            const { data, error } = await supabase
                .from('inventory_price_reports_view')
                .select('product_id, last_price, est_price')
                .in('product_id', chunk)
            if (error) {
                console.error('[getProductReportData] Error fetching fallback prices chunk:', error)
                return []
            }
            return data || []
        })
        const results = await Promise.all(promises)
        results.flat().forEach((row: any) => {
            priceMap[row.product_id] = {
                last_price: row.last_price || 0,
                est_price: row.est_price || 0,
            }
        })
    }

    // Calculate order totals
    type OrderTotals = {
        total_revenue: number
        total_purchase_cost: number
        items: any[]
    }
    const orderTotalsMap: Record<string, OrderTotals> = {}

    allOrderItems.forEach((item: any) => {
        const orderId = item.order_id
        if (!orderTotalsMap[orderId]) {
            orderTotalsMap[orderId] = {
                total_revenue: 0,
                total_purchase_cost: 0,
                items: []
            }
        }
        const entry = orderTotalsMap[orderId]
        const qty = item.quantity || 1
        const amount = item.amount || 0
        const unitCost = item.purchase_cost || (item.product_id ? (priceMap[item.product_id]?.last_price || priceMap[item.product_id]?.est_price || 0) : 0)

        entry.total_revenue += amount * qty
        entry.total_purchase_cost += unitCost * qty
        entry.items.push({
            ...item,
            resolved_purchase_cost: unitCost
        })
    })

    // ── Step 4: Aggregate per product_name + seller_account ───────────────────
    type ProductKey = string
    const productMap: Map<ProductKey, {
        product_name: string
        seller_sku: string
        seller_account: string
        sold_qty: number
        delivered_qty: number
        shipped_qty: number
        total_orders: Set<string>
        delivered_revenue: number
        delivered_profit: number
        delivered_qty_with_cost: number
        has_profit_data: boolean
    }> = new Map()

    for (const item of items) {
        const pName = (item.product_name || 'Unknown').trim()
        const sSku = (item.seller_sku || '').trim()
        const sAccount = (item.seller_account || 'Unknown').trim()
        const key: ProductKey = `${pName}||${sAccount}`

        if (!productMap.has(key)) {
            productMap.set(key, {
                product_name: pName,
                seller_sku: sSku,
                seller_account: sAccount,
                sold_qty: 0,
                delivered_qty: 0,
                shipped_qty: 0,
                total_orders: new Set(),
                delivered_revenue: 0,
                delivered_profit: 0,
                delivered_qty_with_cost: 0,
                has_profit_data: false,
            })
        }

        const entry = productMap.get(key)!
        const effectiveStatus = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
        const qty = item.quantity || 1
        const orderId = item.daraz_orders?.id

        if (orderId) entry.total_orders.add(orderId)

        // ── Sold Qty (excludes non-sold statuses) ──────────────────────────
        const isNonSold = NON_SOLD_STATUSES.some(s =>
            s.toLowerCase() === effectiveStatus.toLowerCase()
        )
        if (!isNonSold) {
            entry.sold_qty += qty
        }

        // ── Delivered Qty + Revenue ────────────────────────────────────────
        const orderStatus = (item.daraz_orders?.order_status || '').trim().toLowerCase()
        if (orderStatus === 'delivered') {
            entry.delivered_qty += qty
            entry.delivered_revenue += (item.amount || 0) * qty
        }

        // ── Shipped Qty (pipeline / in-transit) ──────────────────────────
        if (effectiveStatus === 'shipped') {
            entry.shipped_qty += qty
        }
    }

    // ── Step 5: Per-product profit calculation ─────────────────────────────────
    // For each delivered item we calculate:
    //
    //   product_revenue    = item.amount × qty
    //   product_cost       = resolved purchase_cost × qty (from items_summary fallback to inventory_price_reports_view)
    //   order_total_rev    = orderTotalsMap[orderId].total_revenue (total revenue for all items in the order)
    //   fee_share          = (daraz_fees + 30) × (product_revenue / order_total_rev)
    //   product_profit     = product_revenue - product_cost - fee_share
    //
    // We only accumulate profit for units that have a valid synced purchase cost (> 0)
    // to calculate the exact per-piece unit profit.

    for (const item of items) {
        const orderStatus = (item.daraz_orders?.order_status || '').trim().toLowerCase()
        if (orderStatus !== 'delivered') continue

        const orderId = item.daraz_orders?.id
        if (!orderId) continue

        const totals = orderTotalsMap[orderId]
        // If no order totals available, skip profit calculation
        if (!totals) continue

        const pName = (item.product_name || 'Unknown').trim()
        const sSku = (item.seller_sku || '').trim()
        const sAccount = (item.seller_account || 'Unknown').trim()
        const key: ProductKey = `${pName}||${sAccount}`
        const entry = productMap.get(key)
        if (!entry) continue

        const qty = item.quantity || 1
        const productRevenue = (item.amount || 0) * qty
        const orderTotalRev = totals.total_revenue || 1
        const darazFees = item.daraz_orders?.daraz_fees || 0

        // Find matched item in order totals to get its resolved purchase cost
        // Match by seller_sku variation to ensure correctness for combo/SKU variants
        const matchedOrderItem = totals.items.find((oi: any) =>
            (oi.seller_sku || '').trim().toLowerCase() === sSku.toLowerCase()
        )

        // Purchase cost — priority: items_summary (incorporates fallback) → locked cost on item → 0
        const purchaseCostPerUnit = matchedOrderItem ? matchedOrderItem.resolved_purchase_cost : 0
        const productCost = purchaseCostPerUnit * qty

        // Proportional fee share (daraz_fees + 30) for this product in this order
        const revenueShare = orderTotalRev > 0 ? productRevenue / orderTotalRev : 0
        const feeShare = (darazFees + 30) * revenueShare

        // Product profit = revenue - cost - fee
        const productProfit = productRevenue - productCost - feeShare

        // Only aggregate profit if we have a valid purchase cost (> 0)
        if (purchaseCostPerUnit > 0) {
            entry.delivered_profit += productProfit
            entry.delivered_qty_with_cost += qty
            entry.has_profit_data = true
        }
    }

    // ── Step 5: Convert to sorted array with unit_profit & projected_profit ───
    const allRows: ProductReportRow[] = Array.from(productMap.values())
        .filter(e => e.total_orders.size > 0)
        .map(e => {
            const unitProfit = e.has_profit_data && e.delivered_qty_with_cost > 0
                ? e.delivered_profit / e.delivered_qty_with_cost
                : null

            const projectedProfit = unitProfit !== null && e.shipped_qty > 0
                ? unitProfit * e.shipped_qty
                : null

            return {
                product_name: e.product_name,
                seller_sku: e.seller_sku,
                seller_account: e.seller_account,
                sold_qty: e.sold_qty,
                delivered_qty: e.delivered_qty,
                shipped_qty: e.shipped_qty,
                total_orders: e.total_orders.size,
                delivered_revenue: e.delivered_revenue,
                delivered_profit: e.has_profit_data ? e.delivered_profit : null,
                delivered_qty_with_cost: e.delivered_qty_with_cost,
                has_profit_data: e.has_profit_data,
                unit_profit: unitProfit,
                projected_profit: projectedProfit,
            }
        })
        .sort((a, b) => b.sold_qty - a.sold_qty)

    // Calculate overall totals across all products (before page pagination)
    const overallSummary = {
        total_sold_qty: allRows.reduce((s, r) => s + r.sold_qty, 0),
        total_delivered_qty: allRows.reduce((s, r) => s + r.delivered_qty, 0),
        total_shipped_qty: allRows.reduce((s, r) => s + r.shipped_qty, 0),
        total_delivered_revenue: allRows.reduce((s, r) => s + r.delivered_revenue, 0),
        total_delivered_profit: allRows.reduce((s, r) => s + (r.delivered_profit || 0), 0),
        total_projected_profit: allRows.reduce((s, r) => s + (r.projected_profit || 0), 0),
        has_profit_rows: allRows.some(r => r.has_profit_data),
        has_projected_rows: allRows.some(r => r.projected_profit !== null),
    }

    // ── Step 6: Paginate ──────────────────────────────────────────────────────
    const total = allRows.length
    const from = (page - 1) * limit
    const paginatedRows = allRows.slice(from, from + limit)

    return {
        rows: paginatedRows,
        summary: overallSummary,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    }
}

// Get Daraz customer details (names, phones, orders, statuses) for the customer list subpage
export async function getDarazCustomerDetails(params: {
    page?: number
    limit?: number
    search?: string
    sellerAccount?: string
    status?: string
    all?: boolean
}) {
    const supabase = await createClient()
    const { page = 1, limit = 50, search, sellerAccount, status, all = false } = params

    try {
        let query = supabase
            .from('daraz_orders_with_totals')
            .select('id, customer_name, order_number, order_id, seller_account, shipping_phone, order_status, order_date, items_detail', { count: 'exact' })
            .not('shipping_phone', 'is', null)
            .or('deleted.is.null,deleted.eq.false')

        if (sellerAccount && sellerAccount !== 'all') {
            query = query.eq('seller_account', sellerAccount)
        }

        if (status && status !== 'all') {
            query = query.eq('order_status', status)
        }

        if (search && search.trim()) {
            const term = search.trim()
            query = query.or(`customer_name.ilike.%${term}%,shipping_phone.ilike.%${term}%,order_number.ilike.%${term}%`)
        }

        // Apply pagination if we aren't exporting all
        if (!all) {
            const from = (page - 1) * limit
            const to = from + limit - 1
            query = query.range(from, to)
        }

        const { data, error, count } = await query.order('order_date', { ascending: false })

        if (error) throw error

        return {
            customers: data || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        }
    } catch (error: any) {
        console.error('Error fetching Daraz customer details:', error)
        throw new Error(error.message || 'Failed to fetch customer details')
    }
}

// Update order remarks/note
export async function updateDarazOrderRemarks(orderId: string, remarks: string | null) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        // Fetch order status to check validation
        const { data: order, error: fetchError } = await supabase
            .from('daraz_orders')
            .select('order_status')
            .eq('id', orderId)
            .single()

        if (fetchError || !order) {
            throw new Error('Order not found')
        }

        const allowedStatuses = ['pending', 'ready to ship', 'ready_to_ship', 'packed']
        const currentStatus = order.order_status?.toLowerCase() || ''
        if (!allowedStatuses.includes(currentStatus)) {
            throw new Error(`Cannot add or edit note when order status is ${order.order_status}`)
        }

        const { error } = await supabase
            .from('daraz_orders')
            .update({ 
                remarks,
                updated_by: user.id
            })
            .eq('id', orderId)

        if (error) throw error

        return { success: true }
    } catch (error: any) {
        console.error('Error updating remarks:', error)
        return { success: false, error: error.message || 'Failed to update remarks' }
    }
}



