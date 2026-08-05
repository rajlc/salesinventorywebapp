'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Product {
    id: string
    product_id: number
    product_name: string
    image_url: string | null
    product_type: 'single' | 'combo'
    seller_sku1: string | null
    seller_account1: string | null
    seller_sku2: string | null
    seller_account2: string | null
    seller_sku3: string | null
    seller_account3: string | null
    seller_sku4: string | null
    seller_account4: string | null
    created_by: string | null
    created_at: string
    updated_by: string | null
    updated_at: string
    import_flag: boolean
    is_deleted: boolean
    status?: string // 'Active' | 'Inactive'
    product_combos?: { count?: number; id?: string; quantity?: number; child_product_id?: string }[]
    sales_priority?: boolean
    priority_seller_account?: string | null
    marketplace_sync_status?: 'Pending' | 'Done'
    website_sync_status?: 'Pending' | 'Done'
    approval_status?: 'Pending' | 'Approved'
    daraz_product_url?: string | null
    product_title?: string | null
    other_images?: string[] | null
    description?: string | null
    highlights?: string | null
    special_price?: number | null
    regular_price?: number | null
    category_name?: string | null
    website_category?: string | null
    is_new_pushed?: boolean
    pushed_at?: string | null
}

export interface ProductCombo {
    id: string
    parent_product_id: string
    child_product_id: string
    quantity: number
    created_at: string
}

export interface ApprovalRequest {
    id: string
    resource_type: string
    resource_id: string
    resource_name: string
    action_type: string
    requested_by: string | null
    requested_at: string
    expires_at: string
    status: 'pending' | 'approved' | 'rejected' | 'expired'
    reviewed_by: string | null
    reviewed_at: string | null
    metadata: any
}

export interface DeletedItem {
    id: string
    resource_type: string
    resource_id: string
    resource_name: string
    resource_data: any
    related_data: any
    deleted_by: string | null
    deleted_at: string
    approved_by: string | null
    approved_at: string | null
    expires_at: string
    is_restored: boolean
    restored_by: string | null
    restored_at: string | null
}

// ============================================================================
// PRODUCT CRUD OPERATIONS
// ============================================================================

/**
 * Get paginated list of products with search and filters
 */
export async function getProducts(params: {
    page?: number
    limit?: number
    search?: string
    productType?: 'single' | 'combo' | 'all'
    syncFilter?: 'all' | 'website_pending' | 'marketplace_pending' | 'variation_product'
}) {
    const { page = 1, limit = 50, search = '', productType = 'all', syncFilter = 'all' } = params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Calculate pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build query
    let query = supabase
        .from('products')
        // Select all fields + details of combo items (where product is PARENT)
        .select('*, product_combos!product_combos_parent_product_id_fkey(id, child_product_id, quantity)', { count: 'exact' })
        .eq('is_deleted', false) // Only show non-deleted products
    // .order('is_deleted', { ascending: true }) // No longer needed as we filter filtered


    // Apply product type filter
    if (productType !== 'all') {
        query = query.eq('product_type', productType)
    }

    // Apply sync filters server-side
    if (syncFilter === 'website_pending') {
        query = query.eq('website_sync_status', 'Pending')
    } else if (syncFilter === 'marketplace_pending') {
        query = query.eq('marketplace_sync_status', 'Pending')
    } else if (syncFilter === 'variation_product') {
        // Query product_combos to find parents with exactly 1 component
        const { data: combos } = await supabase
            .from('product_combos')
            .select('parent_product_id')
        
        const counts: Record<string, number> = {}
        combos?.forEach(c => {
            counts[c.parent_product_id] = (counts[c.parent_product_id] || 0) + 1
        })
        const variationParentIds = Object.keys(counts).filter(id => counts[id] === 1)
        
        if (variationParentIds.length > 0) {
            query = query.in('id', variationParentIds)
        } else {
            // Force empty result if no variations exist
            query = query.eq('id', '00000000-0000-0000-0000-000000000000')
        }
    }

    // Apply search across multiple fields
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        let orQuery = `product_name.ilike.${searchTerm},seller_sku1.ilike.${searchTerm},seller_sku2.ilike.${searchTerm},seller_sku3.ilike.${searchTerm},seller_sku4.ilike.${searchTerm}`

        // If search looks like a number, allow searching by ID match
        if (!isNaN(Number(search.trim()))) {
            orQuery += `,product_id.eq.${search.trim()}`
        }

        query = query.or(orQuery)
    }

    // Sort so that just/recently pushed products appear at the absolute top,
    // then Pending approvals and Pending syncs, then alphabetically by product name.
    query = query
        .order('is_new_pushed', { ascending: false, nullsFirst: false })
        .order('pushed_at', { ascending: false, nullsFirst: false })
        .order('approval_status', { ascending: false, nullsFirst: false })
        .order('marketplace_sync_status', { ascending: false, nullsFirst: false })
        .order('website_sync_status', { ascending: false, nullsFirst: false })
        .order('product_name', { ascending: true })

    // Apply pagination
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    return {
        products: data as Product[],
        totalCount: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

/**
 * Optimized product search for dropdowns
 * Selects minimal fields and removes heavy joins
 */
export async function searchProducts(search: string) {
    const supabase = await createClient()

    if (!search || !search.trim()) return []

    const searchTerm = `%${search.trim()}%`

    // Search primarily in product_name and seller_sku1
    const { data, error } = await supabase
        .from('products')
        .select('id, product_name, seller_sku1, product_type')
        .or(`product_name.ilike.${searchTerm},seller_sku1.ilike.${searchTerm}`)
        .order('product_name', { ascending: true })
        .limit(20)

    if (error) {
        console.error('Search products error:', error)
        return []
    }

    return data || []
}

/**
 * Get ALL products (lightweight) for client-side filtering
 * Returns only id, name, and seller sku
 */
/**
 * Get ALL products (lightweight) for client-side filtering
 * Returns only id, name, and seller sku.
 * Uses batch fetching to bypass 1000-row limit.
 * Implements caching to avoid repeated API calls.
 */
export async function getAllProductOptions() {
    // Check for cached data first
    if (typeof window !== 'undefined') {
        const cachedData = sessionStorage.getItem('allProductsCache');
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            // Cache for 5 minutes (300,000 ms)
            if (Date.now() - timestamp < 300000) {
                return data;
            }
        }
    }

    const supabase = await createClient()

    let allProducts: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
        const from = page * pageSize
        const to = from + pageSize - 1

        const { data, error } = await supabase
            .from('products')
            .select('id, product_name, seller_sku1, seller_sku2, product_type')
            .eq('is_deleted', false) // Only show non-deleted products
            // .eq('status', 'Active') // Removed to show Inactive products too
            .order('product_name', { ascending: true })
            .range(from, to)

        if (error) {
            console.error('Get all products error:', error)
            throw new Error(error.message)
        }

        if (!data || data.length === 0) break

        allProducts = allProducts.concat(data)

        if (data.length < pageSize) break
        page++
    }

    // Cache the data in sessionStorage
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('allProductsCache', JSON.stringify({
            data: allProducts,
            timestamp: Date.now()
        }));
    }

    return allProducts
}

/**
 * Get ALL products for POS (includes image & price)
 * Optimized for client-side search/filtering
 */
export async function getAllPosProducts() {
    const supabase = await createClient()

    let allProducts: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
        const from = page * pageSize
        const to = from + pageSize - 1

        const { data, error } = await supabase
            .from('products')
            .select('id, product_name, product_id, seller_sku1, image_url, est_price, product_type')
            .eq('is_deleted', false)
            .eq('status', 'Active')
            .order('product_name', { ascending: true })
            .range(from, to)

        if (error) {
            console.error('Get POS products error:', error)
            throw new Error(error.message)
        }

        if (!data || data.length === 0) break

        allProducts = allProducts.concat(data)

        if (data.length < pageSize) break
        page++
    }

    return allProducts
}

/**
 * Get inactive products (Status = 'Inactive' AND is_deleted = false)
 */
export async function getInactiveProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'Inactive')
        .eq('is_deleted', false)
        .order('product_name', { ascending: true })

    if (error) throw new Error(error.message)
    return data as Product[]
}

/**
 * Get deleted products (Trash) directly from products table
 */
export async function getDeletedProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data as Product[]
}

/**
 * Get single product by ID with combo items
 */
export async function getProductById(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get product
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_deleted', false)
        .single()

    if (productError) throw new Error(productError.message)
    if (!product) throw new Error('Product not found')

    // If combo, get combo items
    let comboItems: any[] = []
    if (product.product_type === 'combo') {
        const { data: combos, error: comboError } = await supabase
            .from('product_combos')
            .select(`
                id,
                quantity,
                child:products!product_combos_child_product_id_fkey(
                    id,
                    product_id,
                    product_name
                )
            `)
            .eq('parent_product_id', productId)

        if (comboError) throw new Error(comboError.message)
        comboItems = combos || []
    }

    // Get creator/updater details
    const { data: creator } = await supabase.rpc('get_user_display_name', { user_id: product.created_by })
    const { data: updater } = await supabase.rpc('get_user_display_name', { user_id: product.updated_by })

    return {
        ...product,
        combo_items: comboItems,
        created_by_name: creator,
        updated_by_name: updater
    }
}

/**
 * Get multiple products by IDs with combo items (Batch Resolve)
 */
export async function getResolvedProductsByIds(productIds: string[]) {
    const supabase = await createClient()

    if (productIds.length === 0) return []

    // Get products
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)

    if (productsError) throw new Error(productsError.message)
    if (!products) return []

    // Get all combo items for these products (where parent is in list)
    // Filter productIds to only those that are 'combo' type to optimize
    const comboProductIds = products.filter(p => p.product_type === 'combo').map(p => p.id)

    let allComboItems: any[] = []
    if (comboProductIds.length > 0) {
        const { data: combos, error: comboError } = await supabase
            .from('product_combos')
            .select(`
                parent_product_id,
                id,
                quantity,
                child:products!product_combos_child_product_id_fkey(
                    id,
                    product_id,
                    product_name,
                    image_url
                )
            `)
            .in('parent_product_id', comboProductIds)

        if (comboError) throw new Error(comboError.message)
        allComboItems = combos || []
    }

    // Stitch together
    return products.map(product => {
        const comboItems = allComboItems.filter(c => c.parent_product_id === product.id)
        return {
            ...product,
            combo_items: comboItems
        }
    })
}

/**
 * Create new product
 */
export async function createProduct(data: {
    product_name: string
    image_url?: string
    product_type: 'single' | 'combo'
    seller_sku1?: string
    seller_account1?: string
    seller_sku2?: string
    seller_account2?: string
    seller_sku3?: string
    seller_account3?: string
    seller_sku4?: string
    seller_account4?: string
    combo_items?: Array<{ child_product_id: string; quantity: number }>
    import_flag?: boolean
    sales_priority?: boolean
    priority_seller_account?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Validate product name
    if (!data.product_name || !data.product_name.trim()) {
        throw new Error('Product name is required')
    }

    // Validate combo items if product type is combo
    if (data.product_type === 'combo') {
        if (!data.combo_items || data.combo_items.length === 0) {
            throw new Error('Combo products must have at least one component')
        }
    }

    // Create product
    const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
            product_name: data.product_name.trim(),
            image_url: data.image_url || null,
            product_type: data.product_type,
            seller_sku1: data.seller_sku1 || null,
            seller_account1: data.seller_account1 || null,
            seller_sku2: data.seller_sku2 || null,
            seller_account2: data.seller_account2 || null,
            seller_sku3: data.seller_sku3 || null,
            seller_account3: data.seller_account3 || null,
            seller_sku4: data.seller_sku4 || null,
            seller_account4: data.seller_account4 || null,
            sales_priority: data.sales_priority ?? false,
            priority_seller_account: data.priority_seller_account || null,
            created_by: user.id,
            updated_by: user.id,
            import_flag: data.import_flag || false,
            status: 'Active'
        })
        .select()
        .single()

    if (productError) throw new Error(productError.message)

    // If combo, create combo items
    if (data.product_type === 'combo' && data.combo_items) {
        const comboInserts = data.combo_items.map(item => ({
            parent_product_id: product.id,
            child_product_id: item.child_product_id,
            quantity: item.quantity
        }))

        const { error: comboError } = await supabase
            .from('product_combos')
            .insert(comboInserts)

        if (comboError) {
            // Rollback: delete the product
            await supabase.from('products').delete().eq('id', product.id)
            throw new Error(`Failed to create combo items: ${comboError.message}`)
        }
    }

    // Log the product creation activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')
        await logActivity('product_created', {
            product_name: data.product_name.trim(),
            product_sku: data.seller_sku1 || undefined
        })
    } catch (logError) {
        console.error('Failed to log product creation:', logError)
    }

    revalidatePath('/dashboard/inventory/product-list')
    return product
}

/**
 * Update existing product
 */
export async function updateProduct(
    productId: string,
    data: Partial<{
        product_name: string
        image_url: string
        product_type: 'single' | 'combo'
        seller_sku1: string
        seller_account1: string
        seller_sku2: string
        seller_account2: string
        seller_sku3: string
        seller_account3: string
        seller_sku4: string
        seller_account4: string
        combo_items: Array<{ child_product_id: string; quantity: number }>
        sales_priority: boolean
        priority_seller_account: string | null
    }>
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get existing product
    const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_deleted', false)
        .single()

    if (!existingProduct) throw new Error('Product not found')

    // Separate combo_items from product fields to avoid schema error
    const { combo_items, ...updatePayload } = data

    // Update product
    const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update({
            ...updatePayload,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()

    if (updateError) throw new Error(updateError.message)

    // Update combo items if product type is combo
    if (data.product_type === 'combo' && data.combo_items) {
        // Delete existing combo items
        await supabase.from('product_combos').delete().eq('parent_product_id', productId)

        // Insert new combo items
        const comboInserts = data.combo_items.map(item => ({
            parent_product_id: productId,
            child_product_id: item.child_product_id,
            quantity: item.quantity
        }))

        const { error: comboError } = await supabase
            .from('product_combos')
            .insert(comboInserts)

        if (comboError) throw new Error(`Failed to update combo items: ${comboError.message}`)
    }

    // Log the product update activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')
        await logActivity('product_updated', {
            product_name: data.product_name || existingProduct.product_name,
            product_sku: data.seller_sku1 || existingProduct.seller_sku1 || undefined
        })
    } catch (logError) {
        console.error('Failed to log product update:', logError)
    }

    revalidatePath('/dashboard/inventory/product-list')
    return updatedProduct
}

/**
 * Delete product (role-based logic)
 * - Admin: Direct delete → Restore Backup
 * - User: Create approval request
 */
export async function toggleProductStatus(productId: string, currentStatus: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active'

    const { error } = await supabase
        .from('products')
        .update({
            status: newStatus,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/inventory/product-list')
    return { status: newStatus, message: `Product marked as ${newStatus}` }
}

export async function deleteProduct(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get user role
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('User profile not found')

    // Get product details
    // Get product details
    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

    if (!product) throw new Error(`Product not found (ID: ${productId})`)
    if (product.is_deleted) throw new Error('Product already deleted')

    let comboItems = []
    if (product.product_type === 'combo') {
        const { data: combos } = await supabase
            .from('product_combos')
            .select('*')
            .eq('parent_product_id', productId)

        comboItems = combos || []
    }

    const productWithCombos = { ...product, combo_items: comboItems }

    const isAdmin = profile.role === 'admin'

    if (isAdmin) {
        // Admin: Direct delete
        // 1. Mark product as deleted
        // 1. Mark product as deleted and Inactive
        await supabase
            .from('products')
            .update({
                is_deleted: true,
                status: 'Inactive'
            })
            .eq('id', productId)

        // 2. Move to restore backup
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 15) // 15 days from now

        await supabase
            .from('deleted_items')
            .insert({
                resource_type: 'product',
                resource_id: productId,
                resource_name: product.product_name,
                resource_data: product,
                related_data: { combo_items: comboItems },
                deleted_by: user.id,
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
            })

        revalidatePath('/dashboard/inventory/product-list')
        return { status: 'deleted', message: 'Product deleted successfully' }
    } else {
        // User: Create approval request
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 48) // 48 hours from now

        const { error: approvalError } = await supabase
            .from('approval_requests')
            .insert({
                resource_type: 'product',
                resource_id: productId,
                resource_name: product.product_name,
                action_type: 'delete',
                requested_by: user.id,
                expires_at: expiresAt.toISOString(),
                metadata: { product_data: product, combo_items: product.combo_items }
            })

        if (approvalError) throw new Error(approvalError.message)

        revalidatePath('/dashboard/inventory/product-list')
        return { status: 'pending', message: 'Delete request sent for approval' }
    }
}

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * Get all approval requests
 */
export async function getApprovalRequests(resourceType?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
        .from('approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })

    if (resourceType) {
        query = query.eq('resource_type', resourceType)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data as ApprovalRequest[]
}

/**
 * Approve delete request
 */
export async function approveDeleteRequest(requestId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can approve requests')
    }

    // Get approval request
    const { data: request } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('id', requestId)
        .single()

    if (!request) throw new Error('Approval request not found')
    if (request.status !== 'pending') throw new Error('Request is not pending')

    // Mark product as deleted
    if (request.resource_type === 'product') {
        await supabase
            .from('products')
            .update({ is_deleted: true })
            .eq('id', request.resource_id)

        // Move to restore backup
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 15)

        await supabase
            .from('deleted_items')
            .insert({
                resource_type: request.resource_type,
                resource_id: request.resource_id,
                resource_name: request.resource_name,
                resource_data: request.metadata.product_data,
                related_data: request.metadata,
                deleted_by: request.requested_by,
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
            })
    }

    // Update approval request
    await supabase
        .from('approval_requests')
        .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/approvals')
    return { success: true }
}

/**
 * Reject delete request
 */
export async function rejectDeleteRequest(requestId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can reject requests')
    }

    // Update approval request
    const { error } = await supabase
        .from('approval_requests')
        .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/approvals')
    return { success: true }
}

// ============================================================================
// RESTORE BACKUP
// ============================================================================

/**
 * Get deleted items for restore
 */
export async function getDeletedItems(resourceType?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Only admins can view restore backup
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can access restore backup')
    }

    let query = supabase
        .from('deleted_items')
        .select('*')
        .eq('is_restored', false)
        // Filter out items "permanently deleted" (hidden) but kept for FK integrity
        .not('related_data->>hidden', 'eq', 'true')
        .order('deleted_at', { ascending: false })

    if (resourceType) {
        // Map plural from UI tabs to singular in DB
        const typeMap: Record<string, string> = { 'products': 'product', 'sales': 'order' }
        const mapped = typeMap[resourceType] || resourceType
        query = query.eq('resource_type', mapped)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data as DeletedItem[]
}

/**
 * Restore deleted product
 * Accepts productId and restores it by setting is_deleted to false
 */
export async function restoreProduct(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can restore items')
    }

    // Restore product directly in products table
    const { error: updateError } = await supabase
        .from('products')
        .update({
            is_deleted: false,
            // Optionally set status to Inactive upon restore, or keep previous status
            // defaulting to Inactive is safer to avoid accidental live listing
            status: 'Inactive',
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)

    if (updateError) throw new Error(updateError.message)

    // Try to mark corresponding entry in deleted_items as restored (if it exists)
    // We try to find match by resource_id
    await supabase
        .from('deleted_items')
        .update({
            is_restored: true,
            restored_by: user.id,
            restored_at: new Date().toISOString()
        })
        .eq('resource_id', productId)
        .eq('resource_type', 'product')
        .eq('is_restored', false)

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/backup')
    return { success: true }
}

/**
 * Delete all pending approval requests (admin only)
 */
export async function deleteAllPendingApprovals() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can delete all approvals')
    }

    const { error } = await supabase
        .from('approval_requests')
        .delete()
        .eq('resource_type', 'product')
        .eq('status', 'pending')

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/approvals')
    return { success: true, message: 'All pending approval requests deleted' }
}

/**
 * Delete all inactive products (hard delete - admin only)
 */
export async function deleteAllInactiveProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can delete all inactive products')
    }

    // Get all inactive products to delete combos first
    const { data: inactiveProducts } = await supabase
        .from('products')
        .select('id')
        .eq('status', 'Inactive')
        .eq('is_deleted', false)

    if (inactiveProducts && inactiveProducts.length > 0) {
        const productIds = inactiveProducts.map(p => p.id)

        // Delete combo relationships first
        await supabase
            .from('product_combos')
            .delete()
            .in('parent_product_id', productIds)

        // Mark products as deleted
        await supabase
            .from('products')
            .update({ is_deleted: true })
            .eq('status', 'Inactive')
            .eq('is_deleted', false)
    }

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/approvals')
    return { success: true, message: `${inactiveProducts?.length || 0} inactive products moved to trash` }
}

/**
 * Permanently delete all products in trash (hard delete - admin only)
 */
export async function permanentlyDeleteAllDeletedProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can permanently delete products')
    }

    // Get all deleted products
    const { data: deletedProducts, error: fetchError } = await supabase
        .from('products')
        .select('id')
        .eq('is_deleted', true)

    if (fetchError) throw new Error(`Failed to fetch deleted products: ${fetchError.message}`)

    if (!deletedProducts || deletedProducts.length === 0) {
        return { success: true, message: 'No products to delete' }
    }

    const productIds = deletedProducts.map(p => p.id)

    // Check ALL tables that might reference products
    const referencedProductIds = new Set<string>()

    // Check purchases table
    const { data: purchaseRefs } = await supabase
        .from('purchases')
        .select('product_id')
        .in('product_id', productIds)

    purchaseRefs?.forEach(p => referencedProductIds.add(p.product_id))

    // Check sales/order items (if exists)
    const { data: salesRefs } = await supabase
        .from('order_items')
        .select('product_id')
        .in('product_id', productIds)

    salesRefs?.forEach(p => referencedProductIds.add(p.product_id))

    // Check daraz order items (if exists)
    const { data: darazRefs } = await supabase
        .from('daraz_order_items')
        .select('product_id')
        .in('product_id', productIds)

    darazRefs?.forEach(p => referencedProductIds.add(p.product_id))

    // Check marketplace order items (if exists)
    const { data: marketplaceRefs } = await supabase
        .from('marketplace_order_items')
        .select('product_id')
        .in('product_id', productIds)

    marketplaceRefs?.forEach(p => referencedProductIds.add(p.product_id))

    // Check stock adjustments (if exists)
    const { data: stockRefs } = await supabase
        .from('stock_adjustments')
        .select('product_id')
        .in('product_id', productIds)

    stockRefs?.forEach(p => referencedProductIds.add(p.product_id))

    // Check damaged stocks (if exists) 
    const { data: damagedRefs } = await supabase
        .from('damaged_stocks')
        .select('product_id')
        .in('product_id', productIds)

    damagedRefs?.forEach(p => referencedProductIds.add(p.product_id))

    const orphanedProductIds = productIds.filter(id => !referencedProductIds.has(id))

    let deletedCount = 0
    let keptCount = referencedProductIds.size

    console.log('Deletion analysis:', {
        total: productIds.length,
        referenced: keptCount,
        orphaned: orphanedProductIds.length,
        orphanedIds: orphanedProductIds
    })

    // Only delete orphaned products (no foreign key references)
    if (orphanedProductIds.length > 0) {
        // Process in batches of 100 to avoid query limits
        const BATCH_SIZE = 100
        const batches = []

        for (let i = 0; i < orphanedProductIds.length; i += BATCH_SIZE) {
            batches.push(orphanedProductIds.slice(i, i + BATCH_SIZE))
        }

        console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} products each`)

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex]
            console.log(`Deleting batch ${batchIndex + 1}/${batches.length} (${batch.length} products)...`)

            // Delete combo relationships for this batch
            const { error: comboError1 } = await supabase
                .from('product_combos')
                .delete()
                .in('parent_product_id', batch)

            if (comboError1) {
                console.error(`Batch ${batchIndex + 1} - Error deleting parent combos:`, comboError1)
            }

            // Also delete as child in combos
            const { error: comboError2 } = await supabase
                .from('product_combos')
                .delete()
                .in('child_product_id', batch)

            if (comboError2) {
                console.error(`Batch ${batchIndex + 1} - Error deleting child combos:`, comboError2)
            }

            // Permanently delete this batch of products
            const { error: deleteError, count } = await supabase
                .from('products')
                .delete({ count: 'exact' })
                .in('id', batch)

            if (deleteError) {
                console.error(`Batch ${batchIndex + 1} - Delete error:`, deleteError)
                throw new Error(`Failed to delete batch ${batchIndex + 1}: ${deleteError.message}`)
            }

            deletedCount += (count || 0)
            console.log(`Batch ${batchIndex + 1} completed: ${count} products deleted`)
        }

        console.log(`Total deleted: ${deletedCount} products`)
    }

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/approvals')

    // Build informative message
    let message = ''
    if (deletedCount > 0) {
        message += `✅ ${deletedCount} product${deletedCount > 1 ? 's' : ''} permanently deleted. `
    }
    if (keptCount > 0) {
        message += `⚠️ ${keptCount} product${keptCount > 1 ? 's' : ''} kept (have transaction history).`
    }
    if (deletedCount === 0 && keptCount === 0) {
        message = 'No products to delete.'
    }
    if (deletedCount === 0 && keptCount > 0) {
        message = `All ${keptCount} product${keptCount > 1 ? 's' : ''} have transaction history and cannot be deleted. They will remain hidden.`
    }

    return {
        success: true,
        message: message.trim(),
        details: {
            deleted: deletedCount,
            kept: keptCount,
        }
    }
}


// ============================================================================
// CSV IMPORT/EXPORT
// ============================================================================

/**
 * Bulk import products from CSV data
 */
export async function bulkImportProducts(products: Array<Partial<Product>>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; product: string; error: string }>
    }

    // Filter out rows with empty product names and prepare batch data
    const validProducts = products
        .map((p, index) => ({ ...p, originalIndex: index }))
        .filter(p => p.product_name && p.product_name.trim())

    if (validProducts.length === 0) {
        return results
    }

    // Prepare batch insert data
    const batchData = validProducts.map(productData => ({
        product_name: productData.product_name!.trim(),
        image_url: productData.image_url || null,
        product_type: productData.product_type || 'single',
        seller_sku1: productData.seller_sku1 || null,
        seller_account1: productData.seller_account1 || null,
        seller_sku2: productData.seller_sku2 || null,
        seller_account2: productData.seller_account2 || null,
        seller_sku3: productData.seller_sku3 || null,
        seller_account3: productData.seller_account3 || null,
        seller_sku4: productData.seller_sku4 || null,
        seller_account4: productData.seller_account4 || null,
        created_by: user.id,
        updated_by: user.id,
        import_flag: true,
        status: 'Active'
    }))

    // Process in chunks of 500 to avoid timeout
    const CHUNK_SIZE = 500
    for (let i = 0; i < batchData.length; i += CHUNK_SIZE) {
        const chunk = batchData.slice(i, i + CHUNK_SIZE)

        try {
            const { data, error } = await supabase
                .from('products')
                .insert(chunk)
                .select()

            if (error) {
                // If batch fails, try individual inserts for this chunk
                for (let j = 0; j < chunk.length; j++) {
                    try {
                        await supabase.from('products').insert(chunk[j])
                        results.success++
                    } catch (individualError: any) {
                        results.failed++
                        const originalIndex = validProducts[i + j].originalIndex
                        results.errors.push({
                            row: originalIndex + 2,
                            product: chunk[j].product_name,
                            error: individualError.message
                        })
                    }
                }
            } else {
                results.success += data.length
            }
        } catch (error: any) {
            // Fallback to individual inserts for this chunk
            for (let j = 0; j < chunk.length; j++) {
                try {
                    await supabase.from('products').insert(chunk[j])
                    results.success++
                } catch (individualError: any) {
                    results.failed++
                    const originalIndex = validProducts[i + j].originalIndex
                    results.errors.push({
                        row: originalIndex + 2,
                        product: chunk[j].product_name,
                        error: individualError.message
                    })
                }
            }
        }
    }

    revalidatePath('/dashboard/inventory/product-list')
    return results
}

/**
 * Export products to CSV format
 */
export async function exportProducts(filter: 'all' | 'marketplace_pending' | 'website_pending' = 'all') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Helper to strip HTML tags, decode entities, and remove URLs
    const cleanTextForMarketplace = (input: string | null): string => {
        if (!input) return ''
        
        // 1. Strip HTML tags
        let text = input
            .replace(/<\/li>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]*>/g, '') // Strip remaining HTML tags
            
        // 2. Decode HTML entities
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            
        // 3. Strip URLs (http://, https://, www. patterns)
        text = text
            .replace(/https?:\/\/[^\s"']+/gi, '')
            .replace(/www\.[^\s"']+/gi, '')
            
        // 4. Clean up consecutive spaces or newlines
        text = text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n')
            
        return text.trim()
    }

    let query = supabase
        .from('products')
        .select('*')
        .eq('is_deleted', false)
        .order('product_name', { ascending: true })

    if (filter === 'marketplace_pending') {
        query = query.eq('marketplace_sync_status', 'Pending')
    } else if (filter === 'website_pending') {
        query = query.eq('website_sync_status', 'Pending')
    }

    const { data: products, error } = await query

    if (error) throw new Error(error.message)

    if (filter === 'marketplace_pending') {
        // Find max number of other images to create dynamic columns
        let maxOtherImages = 0
        products?.forEach(p => {
            if (Array.isArray(p.other_images)) {
                if (p.other_images.length > maxOtherImages) {
                    maxOtherImages = p.other_images.length
                }
            }
        })

        // Transform for Marketplace Pending
        const csvData = (products || []).map(p => {
            const row: Record<string, any> = {
                'Daraz Product Title': p.product_title || p.product_name || '',
                'Marketplace Category': p.marketplace_category || '',
                'Product Image 1': p.image_url || '',
            }

            // Add other images one by one column
            for (let i = 0; i < maxOtherImages; i++) {
                const imgUrl = (Array.isArray(p.other_images) && p.other_images[i]) ? p.other_images[i] : ''
                row[`Product Image ${i + 2}`] = imgUrl
            }

            row['Regular Price'] = p.regular_price || 0
            row['Special Price'] = p.special_price || ''
            row['Product Description'] = cleanTextForMarketplace(p.description)
            row['Product Highlights'] = cleanTextForMarketplace(p.highlights)

            return row
        })

        return csvData
    }

    // Default transform for other filters (all, website_pending)
    const csvData = (products || []).map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        image_url: p.image_url || '',
        product_type: p.product_type,
        status: p.status || 'Active',
        approval_status: p.approval_status || 'Approved',
        marketplace_sync_status: p.marketplace_sync_status || 'Done',
        website_sync_status: p.website_sync_status || 'Done',
        daraz_product_url: p.daraz_product_url || '',
        seller_sku1: p.seller_sku1 || '',
        seller_account1: p.seller_account1 || '',
        seller_sku2: p.seller_sku2 || '',
        seller_account2: p.seller_account2 || '',
        seller_sku3: p.seller_sku3 || '',
        seller_account3: p.seller_account3 || '',
        seller_sku4: p.seller_sku4 || '',
        seller_account4: p.seller_account4 || '',
    }))

    return csvData
}

/**
 * Delete all products (admin only)
 */
export async function deleteAllProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can delete all products')
    }

    // Get all products
    // Get all products with deletion info
    const { data: products } = await supabase
        .from('products')
        .select('*, product_combos!product_combos_parent_product_id_fkey(id, quantity, child_product_id)')
        .eq('is_deleted', false)

    if (!products || products.length === 0) {
        return { deleted: 0, message: 'No products to delete' }
    }

    // Prepare backup entries
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 15) // 15 days retention
    const expiresAtStr = expiresAt.toISOString()
    const nowStr = new Date().toISOString()

    const backupEntries = products.map(p => ({
        resource_type: 'product',
        resource_id: p.id,
        resource_name: p.product_name,
        resource_data: p,
        related_data: { combo_items: p.product_combos || [] },
        deleted_by: user.id,
        approved_by: user.id,
        approved_at: nowStr,
        expires_at: expiresAtStr,
        created_at: nowStr,
        is_restored: false
    }))

    // Bulk insert into deleted_items
    const { error: backupError } = await supabase
        .from('deleted_items')
        .insert(backupEntries)

    if (backupError) {
        throw new Error(`Backup failed: ${backupError.message}`)
    }

    // Mark all products as deleted
    const { error } = await supabase
        .from('products')
        .update({ is_deleted: true })
        .eq('is_deleted', false)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/backup')
    return { deleted: products.length, message: `Successfully deleted ${products.length} products (moved to backup)` }
}

/**
 * Find product by matching any seller sku
 */
export async function getProductBySku(sku: string) {
    const supabase = await createClient()

    // We search all 4 columns. 
    // OR condition: seller_sku1.eq.sku, seller_sku2.eq.sku...

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_deleted', false)
        .or(`seller_sku1.eq.${sku},seller_sku2.eq.${sku},seller_sku3.eq.${sku},seller_sku4.eq.${sku}`)
        .limit(1)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" which is fine
        console.error('Error finding product by SKU:', error)
    }

    return data as Product | null
}

/**
 * Restore/Rescue missing backup items
 * Finds products that are is_deleted=true but missing from deleted_items table
 * and inserts them into deleted_items so they can be managed
 */
export async function restoreMissingBackups() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    // 1. Get all deleted products
    const { data: deletedProducts, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('is_deleted', true)

    if (prodError) throw new Error(`Fetch products error: ${prodError.message}`)
    if (!deletedProducts || deletedProducts.length === 0) return { count: 0, message: 'No deleted products found in database' }

    // 2. Get existing backup entries for products
    const { data: backups, error: backupError } = await supabase
        .from('deleted_items')
        .select('resource_id')
        .eq('resource_type', 'product')

    if (backupError) throw new Error(`Fetch backups error: ${backupError.message}`)

    const existingIds = new Set(backups?.map(b => b.resource_id) || [])

    // 3. Find missing items
    const missingProducts = deletedProducts.filter(p => !existingIds.has(p.id))

    if (missingProducts.length === 0) return { count: 0, message: 'All deleted products are already backed up' }

    // 4. Create backup entries
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 15) // Give them 15 days from now

    // Simplistic backup: doesn't include product_combos in related_data for rescue, but linking works
    const entries = missingProducts.map(p => ({
        resource_type: 'product',
        resource_id: p.id,
        resource_name: p.product_name,
        resource_data: p,
        related_data: { rescued: true, note: 'Recovered from missing backup' },
        deleted_by: user.id, // Attributed to current user as rescuer
        deleted_at: p.updated_at || new Date().toISOString(), // Use updated_at as proxy for delete time
        expires_at: expiresAt.toISOString()
    }))

    const { error: insertError } = await supabase.from('deleted_items').insert(entries)
    if (insertError) throw new Error(`Insert failed: ${insertError.message}`)

    revalidatePath('/dashboard/settings/backup')
    return { count: entries.length, message: `Recovered ${entries.length} missing backup items` }
}

/**
 * Permanently delete ALL products in backup (Empty Trash)
 */
export async function permanentlyDeleteAllProductsBackup() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Admin check
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') throw new Error('Only admins can delete permanently')

    // 1. Get all visible backup items for products
    const { data: items } = await supabase
        .from('deleted_items')
        .select('*')
        .eq('resource_type', 'product')
        .eq('is_restored', false)
        .not('related_data->>hidden', 'eq', 'true')

    if (!items || items.length === 0) return { success: true, message: 'No items to delete.' }

    let deletedCount = 0
    let hiddenCount = 0

    for (const item of items) {
        // 2. Try to hard delete from products table
        const { error } = await supabase.from('products').delete().eq('id', item.resource_id)

        if (error) {
            // Failed (likely FK because product used in history). 
            // Mark as hidden in backup list so it "looks" deleted to user.
            const newData = { ...(item.related_data || {}), hidden: 'true' }
            await supabase.from('deleted_items').update({ related_data: newData }).eq('id', item.id)
            hiddenCount++
        } else {
            // Success. Product gone. Now remove backup entry.
            await supabase.from('deleted_items').delete().eq('id', item.id)
            deletedCount++
        }
    }

    revalidatePath('/dashboard/settings/backup')
    let message = ''
    if (deletedCount > 0) message += `Permanently deleted ${deletedCount} unused products.`
    if (hiddenCount > 0) message += ` ${hiddenCount} used products were invalid for hard-delete and have been hidden.`

    return { success: true, message: message.trim() || 'Process complete.' }
}

/**
 * Approves a synced product (changes approval_status to 'Approved')
 */
export async function approveProduct(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('products')
        .update({
            approval_status: 'Approved',
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/inventory/product-list')
    return data
}

/**
 * Rejects and deletes a synced product completely from the database if new,
 * or reverts it back to Approved if it was an existing product.
 */
export async function rejectProduct(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Fetch the product first to check if it already existed in the system
    const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('created_at, pushed_at')
        .eq('id', productId)
        .maybeSingle()

    if (fetchError) throw new Error(fetchError.message)
    if (!product) throw new Error('Product not found')

    const createdAt = new Date(product.created_at || 0).getTime()
    const pushedAt = new Date(product.pushed_at || 0).getTime()

    // If pushed_at and created_at are within 15 seconds, it's a newly pushed product.
    // We hard delete it to remove it from the inventory list completely.
    if (Math.abs(pushedAt - createdAt) < 15000) {
        console.log(`[rejectProduct] Hard deleting newly pushed product: ${productId}`)
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)

        if (deleteError) throw new Error(deleteError.message)
    } else {
        // If it existed before, we keep the product but discard the "Pending" status and reset is_new_pushed.
        console.log(`[rejectProduct] Reverting existing product status to Approved: ${productId}`)
        const { error: updateError } = await supabase
            .from('products')
            .update({
                approval_status: 'Approved',
                is_new_pushed: false,
                updated_by: user.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', productId)

        if (updateError) throw new Error(updateError.message)
    }

    revalidatePath('/dashboard/inventory/product-list')
    return { success: true }
}

/**
 * Updates sync statuses (Marketplace / Website) for a product
 */
export async function updateSyncStatuses(
    productId: string, 
    marketplaceStatus: 'Pending' | 'Done', 
    websiteStatus: 'Pending' | 'Done'
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('products')
        .update({
            marketplace_sync_status: marketplaceStatus,
            website_sync_status: websiteStatus,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/inventory/product-list')
    return data
}

function getEcommerceSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL
    const key = process.env.ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_ANON_KEY
    if (!url || !key) {
        throw new Error('Ecommerce Supabase configuration is missing in environment variables')
    }
    return createSupabaseClient(url, key)
}

/**
 * Fetch all categories from the ecommerce_categories table
 */
export async function getEcommerceCategories() {
    const warehouseSupabase = await createClient()
    const { data: { user } } = await warehouseSupabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ecommerceSupabase = getEcommerceSupabaseClient()
    const { data, error } = await ecommerceSupabase
        .from('ecommerce_categories')
        .select('id, name, slug, parent_id')
        .order('name')

    if (error) throw new Error(error.message)
    return data
}

/**
 * Fetch all brands from the ecommerce_brands table
 */
export async function getEcommerceBrands() {
    const warehouseSupabase = await createClient()
    const { data: { user } } = await warehouseSupabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ecommerceSupabase = getEcommerceSupabaseClient()
    const { data, error } = await ecommerceSupabase
        .from('ecommerce_brands')
        .select('id, name')
        .order('name')

    if (error) throw new Error(error.message)
    return data
}

function stripHtml(html: string | null): string {
    if (!html) return 'No description provided.'
    let text = html
        .replace(/<\/li>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
    text = text.replace(/<[^>]*>/g, '')
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
}

/**
 * Publish product to the ecommerce storefront database table
 */
export async function pushProductToEcommerce(productId: string, payload: any) {
    const warehouseSupabase = await createClient()
    const { data: { user } } = await warehouseSupabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ecommerceSupabase = getEcommerceSupabaseClient()

    // 1. Generate unique URL slug
    const slug = payload.display_name
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '') + '-' + Math.random().toString(36).substring(2, 5)

    // 2. Insert product into ecommerce_products
    const { data, error: insertError } = await ecommerceSupabase
        .from('ecommerce_products')
        .insert({
            ...payload,
            description: stripHtml(payload.description),
            slug,
            status: 'active',
            price: payload.regular_price || 0,
            rating: 0,
            reviews_count: 0,
            created_at: new Date().toISOString()
        })
        .select()
        .single()

    if (insertError) {
        throw new Error(insertError.message)
    }

    // 3. Update products table sync status in warehouse
    const { error: updateError } = await warehouseSupabase
        .from('products')
        .update({
            website_sync_status: 'Done',
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)

    if (updateError) {
        throw new Error(updateError.message)
    }

    revalidatePath('/dashboard/inventory/product-list')
    return { success: true, data }
}

/**
 * Fetch all category mappings
 */
export async function getCategoryMappings() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('daraz_website_category_mappings')
        .select('*')
        .order('daraz_category')

    if (error) throw new Error(error.message)
    return data
}

/**
 * Bulk upload category mappings
 */
export async function bulkUploadCategoryMappings(mappings: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    if (!Array.isArray(mappings) || mappings.length === 0) {
        throw new Error('No mappings provided')
    }

    // Clean, validate and deduplicate mappings by daraz_category (case-insensitive)
    const cleanedMap = new Map<string, any>()
    for (const m of mappings) {
        const darazCategory = String(m['Daraz Category'] || m.daraz_category || '').trim()
        const websiteCategory = String(m['Website Category'] || m.website_category || '').trim()
        const marketplaceCategory = String(m['Marketplace Category'] || m.marketplace_category || '').trim()
        
        if (darazCategory) {
            cleanedMap.set(darazCategory.toLowerCase().trim(), {
                daraz_category: darazCategory,
                website_category: websiteCategory || null,
                marketplace_category: marketplaceCategory || null
            })
        }
    }
    const cleaned = Array.from(cleanedMap.values())

    if (cleaned.length === 0) {
        throw new Error('No valid mapping rows found. Ensure columns are named exactly "Daraz Category", "Website Category", or "Marketplace Category"')
    }

    // Perform bulk upsert in batches of 500
    const batchSize = 500
    for (let i = 0; i < cleaned.length; i += batchSize) {
        const batch = cleaned.slice(i, i + batchSize)
        const { error } = await supabase
            .from('daraz_website_category_mappings')
            .upsert(batch, { onConflict: 'daraz_category' })
        if (error) throw new Error(error.message)
    }

    // Perform highly targeted updates on categories currently used in products
    try {
        const { data: activeProductsData } = await supabase
            .from('products')
            .select('category_name')
            .not('category_name', 'is', null)

        if (activeProductsData) {
            // Get unique active category names (case-insensitive)
            const uniqueActiveCats = Array.from(
                new Set(activeProductsData.map(p => String(p.category_name).trim()))
            )

            // Filter mappings down to only those matching active categories
            const activeMappings = cleaned.filter(m => 
                uniqueActiveCats.some(cat => cat.toLowerCase() === m.daraz_category.toLowerCase())
            )

            // Run updates only for active categories
            for (const mapItem of activeMappings) {
                await supabase
                    .from('products')
                    .update({ 
                        website_category: mapItem.website_category,
                        marketplace_category: mapItem.marketplace_category
                    })
                    .ilike('category_name', mapItem.daraz_category)
            }
        }
    } catch (updateErr: any) {
        console.error('Failed to auto-update existing products website categories:', updateErr.message)
    }

    return { success: true, count: cleaned.length }
}

/**
 * Delete a category mapping by ID
 */
export async function deleteCategoryMapping(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('daraz_website_category_mappings')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    return { success: true }
}

/**
 * Save (create or update) a single category mapping
 */
export async function saveCategoryMapping(params: {
    darazCategory: string
    websiteCategory?: string | null
    marketplaceCategory?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const darazCategory = params.darazCategory.trim()
    const websiteCategory = params.websiteCategory?.trim() || null
    const marketplaceCategory = params.marketplaceCategory?.trim() || null

    if (!darazCategory) {
        throw new Error('Daraz Category name is required')
    }

    // Upsert into mapping table
    const { data, error } = await supabase
        .from('daraz_website_category_mappings')
        .upsert({
            daraz_category: darazCategory,
            website_category: websiteCategory,
            marketplace_category: marketplaceCategory
        }, { onConflict: 'daraz_category' })
        .select()
        .single()

    if (error) throw new Error(error.message)

    // Perform updates on existing products that match this category
    try {
        await supabase
            .from('products')
            .update({ 
                website_category: websiteCategory,
                marketplace_category: marketplaceCategory
            })
            .ilike('category_name', darazCategory)
    } catch (updateErr: any) {
        console.error('Failed to auto-update matching products categories:', updateErr.message)
    }

    return { success: true, mapping: data }
}

/**
 * Fetch website live price discount settings
 */
export async function getWebsiteDiscountRules() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'website_discount_rules')
        .single()

    if (error && error.code !== 'PGRST116') {
        throw new Error(error.message)
    }

    return data?.value || { active: false, percent: 0 }
}

/**
 * Save website live price discount settings
 */
export async function saveWebsiteDiscountRules(rules: { active: boolean, percent: number }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key: 'website_discount_rules',
            value: rules,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' })

    if (error) throw new Error(error.message)

    if (rules.active) {
        try {
            const { autoUpdateWebsitePrices } = await import('../../sales/actions/avg-price-actions')
            await autoUpdateWebsitePrices()
        } catch (err: any) {
            console.error('[AUTO-PRICE] Background auto pricing failed:', err.message)
        }
    }
    
    revalidatePath('/dashboard/settings/website-marketplace')
    return { success: true }
}

// ============================================================================
// SYNC WEBSITE STATUS
// Connects to the Ecommerce Supabase DB and syncs website_sync_status for all
// inventory products based on whether they are active in the ecommerce store.
// Matching key: inventory.products.product_id == ecommerce.ecommerce_products.warehouse_product_id
// ============================================================================

export async function syncWebsiteStatus(): Promise<{
    success: boolean
    updated: number
    markedDone: number
    markedPending: number
    error?: string
}> {
    try {
        const inventorySupabase = await createClient()
        const { data: { user } } = await inventorySupabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Connect to the Ecommerce Supabase using its own credentials
        const ecommerceUrl = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL
        const ecommerceKey = process.env.ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY
            || process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_ANON_KEY

        if (!ecommerceUrl || !ecommerceKey) {
            throw new Error('Ecommerce Supabase credentials not configured. Add NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL and ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY to .env.local')
        }

        const ecommerceSupabase = createSupabaseClient(ecommerceUrl, ecommerceKey)

        // Fetch all ecommerce products: grab their warehouse_product_id and status
        // Also check if linked as a variation (variations JSONB contains inventory_id entries)
        const { data: ecommerceProducts, error: ecommerceError } = await ecommerceSupabase
            .from('ecommerce_products')
            .select('warehouse_product_id, status, variations')

        if (ecommerceError) {
            throw new Error(`Failed to fetch ecommerce products: ${ecommerceError.message}`)
        }

        // Build a Set of warehouse_product_ids that are ACTIVE in the ecommerce store
        const activeSyncedIds = new Set<string>()

        ;(ecommerceProducts || []).forEach((ep: any) => {
            const wpid = ep.warehouse_product_id != null ? String(ep.warehouse_product_id).trim() : ''
            const isActive = ep.status === 'active'

            // Direct product match - mark as Done if active
            if (wpid && isActive) {
                activeSyncedIds.add(wpid)
            }

            // Variation match - check each variation's inventory_id
            // A variation is "active" if the parent product is active
            if (isActive && Array.isArray(ep.variations)) {
                ep.variations.forEach((v: any) => {
                    if (v.inventory_id) {
                        const vid = String(v.inventory_id).trim()
                        if (vid) activeSyncedIds.add(vid)
                    }
                })
            }
        })

        // Fetch all non-deleted inventory products (just id and product_id)
        const { data: inventoryProducts, error: inventoryError } = await inventorySupabase
            .from('products')
            .select('id, product_id, website_sync_status')
            .eq('is_deleted', false)

        if (inventoryError) {
            throw new Error(`Failed to fetch inventory products: ${inventoryError.message}`)
        }

        const toMarkDone: string[] = []
        const toMarkPending: string[] = []

        ;(inventoryProducts || []).forEach((p: any) => {
            const pid = p.product_id != null ? String(p.product_id).trim() : ''
            const shouldBeDone = pid && activeSyncedIds.has(pid)
            if (shouldBeDone) {
                toMarkDone.push(p.id)
            } else {
                toMarkPending.push(p.id)
            }
        })

        // Bulk update in chunks of 200 to avoid PostgREST URL length limits (Bad Request)
        const CHUNK_SIZE = 200

        const chunkArray = (arr: string[], size: number) => {
            const chunks: string[][] = []
            for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
            return chunks
        }

        // Mark as Done (chunked)
        for (const chunk of chunkArray(toMarkDone, CHUNK_SIZE)) {
            const { error: doneError } = await inventorySupabase
                .from('products')
                .update({ website_sync_status: 'Done' })
                .in('id', chunk)
            if (doneError) throw new Error(`Failed to update Done products: ${doneError.message}`)
        }

        // Mark as Pending (chunked)
        for (const chunk of chunkArray(toMarkPending, CHUNK_SIZE)) {
            const { error: pendingError } = await inventorySupabase
                .from('products')
                .update({ website_sync_status: 'Pending' })
                .in('id', chunk)
            if (pendingError) throw new Error(`Failed to update Pending products: ${pendingError.message}`)
        }

        revalidatePath('/dashboard/inventory/product-list')

        return {
            success: true,
            updated: toMarkDone.length + toMarkPending.length,
            markedDone: toMarkDone.length,
            markedPending: toMarkPending.length,
        }
    } catch (err: any) {
        console.error('[SYNC-WEBSITE-STATUS]', err.message)
        return { success: false, updated: 0, markedDone: 0, markedPending: 0, error: err.message }
    }
}

/**
 * Re-maps website_category and marketplace_category for ALL existing products
 * based on their current category_name and the latest mapping table.
 *
 * Strategy: group products by category_name, then do ONE bulk update per
 * unique category (using .in('id', [ids])) — reduces ~1000 calls to ~50.
 *
 * Rule: if category_name is null → clear both category columns.
 *       if category_name exists → apply mapping (or null if not in mapping).
 */
export async function remapAllCategories(): Promise<{
    success: boolean
    updated: number
    cleared: number
    error?: string
}> {
    try {
        // Use service-role client to bypass RLS on mapping table and products table
        const supabase = await createAdminClient()
        // Also verify user is authenticated via user-session client
        const userSupabase = await createClient()
        const { data: { user } } = await userSupabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // 1. Fetch ALL mapping rows with pagination (Supabase has a 1000-row default limit)
        let mappingsData: any[] = []
        let pageFrom = 0
        const PAGE_SIZE = 1000
        while (true) {
            const { data: pageData, error: pageError } = await supabase
                .from('daraz_website_category_mappings')
                .select('daraz_category, website_category, marketplace_category')
                .range(pageFrom, pageFrom + PAGE_SIZE - 1)

            if (pageError) {
                // marketplace_category column may not exist — fall back
                const { data: pageData2, error: pageError2 } = await supabase
                    .from('daraz_website_category_mappings')
                    .select('daraz_category, website_category')
                    .range(pageFrom, pageFrom + PAGE_SIZE - 1)
                if (pageError2) throw new Error(`Failed to fetch mappings: ${pageError2.message}`)
                mappingsData = [...mappingsData, ...(pageData2 || [])]
                break // No marketplace_category column — stop after first page with fallback
            }
            mappingsData = [...mappingsData, ...(pageData || [])]
            if (!pageData || pageData.length < PAGE_SIZE) break // Last page
            pageFrom += PAGE_SIZE
        }

        type CatMapping = { website_category: string | null; marketplace_category: string | null }
        const mappingMap = new Map<string, CatMapping>()
        for (const m of mappingsData) {
            if (m.daraz_category) {
                mappingMap.set(m.daraz_category.toLowerCase().trim(), {
                    website_category: m.website_category || null,
                    marketplace_category: m.marketplace_category || null,
                })
            }
        }

        // 2. Fetch all non-deleted products (id + category_name only)
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('id, category_name')
            .eq('is_deleted', false)

        if (prodError) throw new Error(`Failed to fetch products: ${prodError.message}`)

        const allProducts = products || []

        const CHUNK = 200
        let updated = 0
        let cleared = 0

        const chunkArray = (arr: string[], size: number): string[][] => {
            const chunks: string[][] = []
            for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
            return chunks
        }

        // 3a. Products with NO category → clear both fields (bulk, chunked)
        const noCategoryIds = allProducts.filter(p => !p.category_name).map(p => p.id)
        for (const chunk of chunkArray(noCategoryIds, CHUNK)) {
            const { error } = await supabase
                .from('products')
                .update({ website_category: null, marketplace_category: null })
                .in('id', chunk)
            if (error) console.error('[RemapCategories] clear error:', error.message)
            else cleared += chunk.length
        }

        // 3b. Group products by their category_name key (lowercased)
        //     Then do ONE bulk update per unique category — ~50 calls instead of ~1000
        const categoryGroups = new Map<string, { ids: string[]; original: string }>()
        for (const p of allProducts) {
            if (!p.category_name) continue
            const key = p.category_name.toLowerCase().trim()
            if (!categoryGroups.has(key)) {
                categoryGroups.set(key, { ids: [], original: p.category_name })
            }
            categoryGroups.get(key)!.ids.push(p.id)
        }

        for (const [catKey, { ids }] of categoryGroups) {
            const mapping = mappingMap.get(catKey) || null
            const websiteCat = mapping?.website_category || null
            const marketplaceCat = mapping?.marketplace_category || null

            for (const chunk of chunkArray(ids, CHUNK)) {
                const { error } = await supabase
                    .from('products')
                    .update({ website_category: websiteCat, marketplace_category: marketplaceCat })
                    .in('id', chunk)
                if (error) {
                    console.error(`[RemapCategories] update error for "${catKey}":`, error.message)
                } else {
                    updated += chunk.length
                }
            }
        }

        revalidatePath('/dashboard/inventory/product-list')

        return { success: true, updated, cleared }
    } catch (err: any) {
        console.error('[REMAP-CATEGORIES]', err.message)
        return { success: false, updated: 0, cleared: 0, error: err.message }
    }
}





