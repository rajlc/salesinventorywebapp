'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PurchasePlan {
    id: string
    plan_date: string
    product_id: string
    product?: {
        product_name: string
        image_url: string | null
        product_type: 'single' | 'combo'
        seller_sku1: string
        seller_sku2: string
        seller_sku3: string
        seller_sku4: string
        combo_items?: { // Flattened structure or raw DB structure? Let's use raw for now to match query
            id: string
            quantity: number
            child: {
                id: string
                product_id: string
                product_name: string
            }
        }[] // Actually, supabase returns it as 'product_combos' usually unless aliased. I will use the query name.
        product_combos?: {
            id: string
            quantity: number
            child: {
                id: string
                product_id: string
                product_name: string
            }
        }[]
    }
    quantity: number
    remarks?: string
    status: 'Pending' | 'Pending Confirmation' | 'Complete' | 'Cancel'
    expires_at: string
    created_at: string
    snapshot_latest_price: number
    snapshot_latest_supplier: string
    snapshot_low_price: number
    snapshot_low_supplier: string
}

export interface ProductPurchaseStats {
    latestPrice: number
    latestSupplier: string
    lowPrice: number
    lowSupplier: string
    last3Orders: any[]
}

/**
 * Cleanup expired plans and fetch active ones.
 * Includes server-side deduplication: if the same product appears multiple
 * times with an active status (Pending / Pending Confirmation), we keep only
 * the oldest plan and delete the extras in the background.
 */
export async function getPurchasePlans() {
    const supabase = await createClient()

    // 1. Cleanup expired plans
    const { error: deleteError } = await supabase
        .from('purchase_plans')
        .delete()
        .lt('expires_at', new Date().toISOString())

    if (deleteError) console.error('Error cleaning up plans:', deleteError)

    // 2. Fetch all plans (newest first for display)
    const { data, error } = await supabase
        .from('purchase_plans')
        .select(`
            *,
            product:products(
                product_name, 
                image_url, 
                product_type, 
                seller_sku1, 
                seller_sku2, 
                seller_sku3, 
                seller_sku4,
                product_combos:product_combos!product_combos_parent_product_id_fkey(
                    id,
                    quantity,
                    child:products!product_combos_child_product_id_fkey(
                        id,
                        product_id,
                        product_name
                    )
                )
            )
        `)
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const plans = (data || []) as PurchasePlan[]
    const activeStatuses = new Set(['Pending', 'Pending Confirmation'])

    // 3. Server-side deduplication — find duplicates for active plans by product_id
    // Sort ascending by created_at to determine which is the "primary" (oldest) plan to keep
    const sortedAsc = [...plans].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const seenActive = new Map<string, string>() // product_id → primary plan id
    const extraIds: string[] = []

    for (const plan of sortedAsc) {
        if (!activeStatuses.has(plan.status)) continue
        if (seenActive.has(plan.product_id)) {
            // This is a duplicate — mark for deletion
            extraIds.push(plan.id)
        } else {
            seenActive.set(plan.product_id, plan.id)
        }
    }

    // 4. Fire-and-forget: delete duplicate rows in the background
    if (extraIds.length > 0) {
        console.warn(`[PurchasePlans] Deduplicating ${extraIds.length} duplicate active plan(s) from DB`)
        supabase.from('purchase_plans').delete().in('id', extraIds).then(({ error: delErr }) => {
            if (delErr) console.error('[PurchasePlans] Error removing duplicates:', delErr.message)
            else console.log(`[PurchasePlans] ✅ Removed ${extraIds.length} duplicate plan(s)`)
        })
    }

    // 5. Return deduplicated list (maintaining newest-first display order)
    const primaryIds = new Set(seenActive.values())
    return plans.filter(p =>
        !activeStatuses.has(p.status) || primaryIds.has(p.id)
    ) as PurchasePlan[]
}

/**
 * Get stats for a product
 */
export async function getProductPurchaseStats(productId: string): Promise<ProductPurchaseStats> {
    const supabase = await createClient()

    // Latest Purchase
    const { data: latest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false })
        .limit(1)
        .single()

    // Lowest Price
    const { data: lowest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('unit_amount', { ascending: true })
        .limit(1)
        .single()

    // Last 3 Orders
    const { data: last3 } = await supabase
        .from('purchases')
        .select('purchase_date, unit_amount, quantity, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false })
        .limit(3)

    return {
        latestPrice: latest?.unit_amount || 0,
        latestSupplier: (Array.isArray(latest?.supplier) ? latest?.supplier[0]?.supplier_name : (latest?.supplier as any)?.supplier_name) || 'N/A',
        lowPrice: lowest?.unit_amount || 0,
        lowSupplier: (Array.isArray(lowest?.supplier) ? lowest?.supplier[0]?.supplier_name : (lowest?.supplier as any)?.supplier_name) || 'N/A',
        last3Orders: last3 || []
    }
}

/**
 * Check if product already has an active pending plan
 */
export async function checkActiveProductPlan(productId: string): Promise<boolean> {
    const supabase = await createClient()

    const { count } = await supabase
        .from('purchase_plans')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .in('status', ['Pending', 'Pending Confirmation'])

    return (count && count > 0) ? true : false
}

/**
 * Get all active pending plan product IDs
 */
export async function getActivePlanProductIds(): Promise<string[]> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('purchase_plans')
        .select('product_id')
        .in('status', ['Pending', 'Pending Confirmation'])

    if (!data) return []

    const planProductIds = data.map(plan => plan.product_id).filter(Boolean) as string[]

    if (planProductIds.length === 0) return []

    // Fetch parent combo product IDs that contain these children as components
    const { data: combos } = await supabase
        .from('product_combos')
        .select('parent_product_id')
        .in('child_product_id', planProductIds)

    const parentIds = combos ? combos.map((c: any) => c.parent_product_id).filter(Boolean) as string[] : []

    // Return union of child IDs and parent combo IDs
    return Array.from(new Set([...planProductIds, ...parentIds]))
}

/**
 * Create Plan
 */
export async function createPurchasePlan(data: {
    plan_date: string
    product_id: string
    quantity: number
    remarks?: string
    status?: string
    stats?: {
        latestPrice: number
        latestSupplier: string
        lowPrice: number
        lowSupplier: string
    }
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Check for duplicate pending plan
    const { count } = await supabase
        .from('purchase_plans')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', data.product_id)
        .in('status', ['Pending', 'Pending Confirmation'])

    if (count && count > 0) {
        throw new Error('Product Already in Purchase List')
    }

    const { error } = await supabase
        .from('purchase_plans')
        .insert({
            plan_date: data.plan_date,
            product_id: data.product_id,
            quantity: data.quantity,
            remarks: data.remarks,
            status: data.status || 'Pending',
            created_by: user.id,
            snapshot_latest_price: data.stats?.latestPrice || 0,
            snapshot_latest_supplier: data.stats?.latestSupplier || '',
            snapshot_low_price: data.stats?.lowPrice || 0,
            snapshot_low_supplier: data.stats?.lowSupplier || ''
        })

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/purchase/daily-purchase-list')
}


/**
 * Update Plan Status
 */
export async function updatePurchasePlanStatus(id: string, status: 'Pending' | 'Pending Confirmation' | 'Complete' | 'Cancel') {
    const supabase = await createClient()

    // Determine new expiry time based on status
    let expiresAt: string | undefined
    const now = new Date()

    if (status === 'Complete') {
        // Complete: 12 hours from now
        expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
    } else if (status === 'Cancel') {
        // Cancel: 2 hours from now
        expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
    }

    const updateData: any = { status }
    if (expiresAt) {
        updateData.expires_at = expiresAt
    }

    const { error } = await supabase
        .from('purchase_plans')
        .update(updateData)
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/purchase/daily-plan')
}

/**
 * Update Full Plan
 */
export async function updatePurchasePlan(id: string, data: { status?: string, quantity?: number, remarks?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('purchase_plans')
        .update({
            ...data,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/purchase/daily-plan')
}


/**
 * Automatically complete plans for a purchased product
 */
export async function completePlanForProduct(productId: string) {
    const supabase = await createClient()

    // Auto-complete (Purchased): 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Find active or completed plans for this product
    const { error } = await supabase
        .from('purchase_plans')
        .update({ status: 'Complete', expires_at: expiresAt })
        .eq('product_id', productId)
        .in('status', ['Pending', 'Pending Confirmation', 'Complete'])

    if (error) console.error('Error auto-completing plans:', error)
}

/**
 * Check completed purchase today
 */
export async function checkTodayPurchase(productId: string) {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
        .from('purchases')
        .select('id')
        .eq('product_id', productId)
        .eq('purchase_date', today)
        .limit(1)
        .single()

    return !!data
}
