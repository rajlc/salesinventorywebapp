/**
 * Auto Purchase Planning Utilities
 *
 * IMPORTANT: This file has NO 'use server' directive intentionally.
 * It is designed to be called from API routes, webhook handlers, and other
 * server-side Node.js contexts directly — NOT as a Next.js Server Action.
 *
 * Server Actions (plan-actions.ts) call these helpers for their auto-plan logic.
 *
 * --- WORKFLOW ---
 * autoPlanPurchaseForOrder is triggered ONLY for orders with status 'Pending'.
 * Orders that are Packed, Ready to Ship, Shipped, Delivered, etc. are skipped.
 *
 * Product type handling:
 *  (1) Single product  → check stock, if stock <= 0 or demand > stock → add/update Pending plan
 *  (2) Combo (multi)   → check stock per component vs order demand → add/update Pending plan per component
 *  (3) Variation/combo (single component) → bypass stock check → add/update Pending Confirmation plan for child component
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ProductPurchaseStatsInternal {
    latestPrice: number
    latestSupplier: string
    lowPrice: number
    lowSupplier: string
}

/**
 * Get active order demand for a product.
 * Only counts orders with status: Pending, Packed, Ready to Ship.
 * Counts both direct orders and indirect demand via parent combo products.
 * Uses PostgREST inner joins to avoid URL length limits on large datasets.
 */
export async function getActiveDemandForProduct(productId: string, supabase: any): Promise<number> {
    let totalDemand = 0

    // Step 1: Direct demand — inner join filters active orders at DB level
    const { data: directItems, error: directErr } = await supabase
        .from('daraz_order_items')
        .select('quantity, daraz_orders!inner(order_status)')
        .eq('product_id', productId)
        .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship'])

    if (directErr) {
        console.error('[AutoPlan] Error fetching direct demand:', directErr.message)
    } else if (directItems && directItems.length > 0) {
        const directSum = directItems.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
        totalDemand += directSum
        console.log(`[AutoPlan]   Direct demand for ${productId}: ${directSum} (from ${directItems.length} order item(s))`)
    }

    // Step 2: Indirect demand via parent combos (this product is a child component)
    const { data: parentCombos, error: comboErr } = await supabase
        .from('product_combos')
        .select('parent_product_id, quantity')
        .eq('child_product_id', productId)

    if (comboErr) {
        console.error('[AutoPlan] Error fetching parent combos:', comboErr.message)
    }

    if (parentCombos && parentCombos.length > 0) {
        const parentIds = parentCombos.map((c: any) => c.parent_product_id)
        console.log(`[AutoPlan]   Child product ${productId} is in ${parentIds.length} parent combo(s)`)

        // Inner join to filter active orders at DB level (avoids URL length issue)
        const { data: parentItems, error: parentErr } = await supabase
            .from('daraz_order_items')
            .select('product_id, quantity, daraz_orders!inner(order_status)')
            .in('product_id', parentIds)
            .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship'])

        if (parentErr) {
            console.error('[AutoPlan] Error fetching parent combo order items:', parentErr.message)
        }

        if (parentItems && parentItems.length > 0) {
            let comboDemand = 0
            parentItems.forEach((item: any) => {
                const combo = parentCombos.find((c: any) => c.parent_product_id === item.product_id)
                if (combo) {
                    comboDemand += (item.quantity || 0) * (combo.quantity || 0)
                }
            })
            totalDemand += comboDemand
            console.log(`[AutoPlan]   Combo demand for ${productId}: +${comboDemand} (from ${parentItems.length} parent order item(s))`)
        }
    }

    console.log(`[AutoPlan]   Total active demand for ${productId}: ${totalDemand}`)
    return totalDemand
}

/**
 * Get current stock from stock_ledger_view (uses product `id` column)
 */
export async function getProductStock(productId: string, supabase: any): Promise<number> {
    const { data, error } = await supabase
        .from('stock_ledger_view')
        .select('total_stock')
        .eq('id', productId)
        .maybeSingle()

    if (error) {
        console.error('[AutoPlan] Error fetching stock:', error)
        return 0
    }
    return Number(data?.total_stock) || 0
}

/**
 * Fetch latest/lowest purchase price snapshots for a product (no auth check)
 */
export async function getProductPurchaseStatsInternal(productId: string, supabase: any): Promise<ProductPurchaseStatsInternal> {
    const { data: latest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    const { data: lowest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('unit_amount', { ascending: true })
        .limit(1)
        .maybeSingle()

    return {
        latestPrice: latest?.unit_amount || 0,
        latestSupplier: (Array.isArray(latest?.supplier)
            ? latest?.supplier[0]?.supplier_name
            : (latest?.supplier as any)?.supplier_name) || '',
        lowPrice: lowest?.unit_amount || 0,
        lowSupplier: (Array.isArray(lowest?.supplier)
            ? lowest?.supplier[0]?.supplier_name
            : (lowest?.supplier as any)?.supplier_name) || '',
    }
}

/**
 * Atomically fetch active plans for a product.
 * If duplicates exist, self-heal by keeping the oldest and deleting extras.
 * Returns the primary (oldest created) active plan, or null if none.
 */
async function getOrMergeActivePlans(productId: string, supabase: any): Promise<any | null> {
    const { data: existingPlans, error: plansErr } = await supabase
        .from('purchase_plans')
        .select('id, status, quantity, remarks')
        .eq('product_id', productId)
        .in('status', ['Pending', 'Pending Confirmation'])
        .order('created_at', { ascending: true }) // oldest first = primary

    if (plansErr) {
        console.error('[AutoPlan] Error fetching existing plans:', plansErr.message)
        return null
    }

    if (!existingPlans || existingPlans.length === 0) {
        return null
    }

    // Self-healing: if duplicates exist, delete all but the oldest
    if (existingPlans.length > 1) {
        console.warn(`[AutoPlan] ⚠️ Found ${existingPlans.length} duplicate plan(s) for product ${productId}. Merging into oldest...`)
        const extraPlanIds = existingPlans.slice(1).map((p: any) => p.id)
        const { error: delErr } = await supabase
            .from('purchase_plans')
            .delete()
            .in('id', extraPlanIds)
        if (delErr) {
            console.error('[AutoPlan] Error deleting duplicate plans:', delErr.message)
        } else {
            console.log(`[AutoPlan] ✅ Removed ${extraPlanIds.length} duplicate plan(s) for product ${productId}`)
        }
    }

    return existingPlans[0] // Return the primary (oldest) plan
}

/**
 * Handle auto-plan logic for a single (non-combo) product.
 *
 * Logic:
 *  - Compute needed = totalActiveDemand - currentStock
 *  - If needed > 0: upsert a 'Pending' plan (update qty if exists, insert if not)
 *  - If needed <= 0: remove the auto-plan if stock became sufficient
 */
async function processSingleProductAutoPlan(productId: string, supabase: any) {
    const { data: product } = await supabase
        .from('products')
        .select('id, product_name')
        .eq('id', productId)
        .maybeSingle()

    if (!product) {
        console.log(`[AutoPlan] Product ${productId} not found in products table — skipping.`)
        return
    }

    const demand = await getActiveDemandForProduct(productId, supabase)
    const stock = await getProductStock(productId, supabase)
    const needed = demand - stock

    console.log(`[AutoPlan]   → "${product.product_name}": demand=${demand}, stock=${stock}, needed=${needed}`)

    // Atomically fetch (and auto-deduplicate) existing active plan
    const existingPlan = await getOrMergeActivePlans(productId, supabase)

    if (needed > 0) {
        if (existingPlan) {
            // Plan already exists — only update quantity, do NOT create a new row
            console.log(`[AutoPlan]   → Plan exists (id: ${existingPlan.id}). Updating qty: ${existingPlan.quantity} → ${needed}`)
            const { error } = await supabase
                .from('purchase_plans')
                .update({ quantity: needed, updated_at: new Date().toISOString() })
                .eq('id', existingPlan.id)
            if (error) console.error('[AutoPlan]   → Update error:', error.message)
        } else {
            // No plan yet — create a new Pending plan
            console.log(`[AutoPlan]   → No plan found. Creating new Pending plan with qty=${needed}`)
            const stats = await getProductPurchaseStatsInternal(productId, supabase)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
            const { error } = await supabase
                .from('purchase_plans')
                .insert({
                    plan_date: new Date().toLocaleDateString('en-CA'),
                    product_id: productId,
                    quantity: needed,
                    status: 'Pending',
                    remarks: 'Auto-planned from order demand',
                    expires_at: expiresAt,
                    snapshot_latest_price: stats.latestPrice,
                    snapshot_latest_supplier: stats.latestSupplier,
                    snapshot_low_price: stats.lowPrice,
                    snapshot_low_supplier: stats.lowSupplier,
                })
            if (error) console.error('[AutoPlan]   → Insert error:', error.message)
        }
    } else {
        // Stock is sufficient — clean up any auto-generated plan
        if (existingPlan && existingPlan.remarks?.startsWith('Auto-planned')) {
            console.log(`[AutoPlan]   → Stock sufficient. Removing auto-plan for "${product.product_name}"`)
            await supabase.from('purchase_plans').delete().eq('id', existingPlan.id)
        } else {
            console.log(`[AutoPlan]   → Stock sufficient (needed=${needed}). No auto-plan needed.`)
        }
    }
}

/**
 * Main entry point: given an internal daraz_orders.id (UUID), compute
 * and update purchase plans for all products in that order.
 *
 * ⚠️  ONLY runs when the order status is 'Pending'.
 *     Orders with status Packed, Ready to Ship, Shipped, Delivered,
 *     Cancel, Returning to Seller, Returned Delivered, etc. are completely
 *     skipped — this prevents old/archived orders from polluting the purchase plan.
 *
 * Called directly from daraz-sync-order.ts (NOT as a Server Action).
 */
export async function autoPlanPurchaseForOrder(orderId: string): Promise<void> {
    const supabase = await createAdminClient()

    console.log(`[AutoPlan] ====== Running for order UUID: ${orderId} ======`)

    // ── GUARD: Only process brand-new Pending orders ──────────────────────────
    const { data: orderData, error: orderStatusErr } = await supabase
        .from('daraz_orders')
        .select('order_status')
        .eq('id', orderId)
        .maybeSingle()

    if (orderStatusErr) {
        console.error(`[AutoPlan] Error fetching order status:`, orderStatusErr.message)
        return
    }

    if (!orderData) {
        console.log(`[AutoPlan] Order ${orderId} not found — skipping.`)
        return
    }

    const orderStatus = orderData.order_status
    if (orderStatus !== 'Pending') {
        console.log(`[AutoPlan] ⏭️  Order ${orderId} has status "${orderStatus}" — skipping auto-plan (only Pending orders are processed).`)
        return
    }

    console.log(`[AutoPlan] ✅ Order status is "Pending" — proceeding with auto-plan evaluation.`)
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Fetch order items for this order
    const { data: orderItems, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select('product_id, product_name, quantity')
        .eq('order_id', orderId)

    if (itemsError) {
        console.error(`[AutoPlan] Error fetching order items:`, itemsError.message)
        return
    }

    if (!orderItems || orderItems.length === 0) {
        console.log(`[AutoPlan] No items in order ${orderId} — skipping.`)
        return
    }

    console.log(`[AutoPlan] Order has ${orderItems.length} item(s):`,
        orderItems.map((i: any) => `${i.product_name} (qty: ${i.quantity}, product_id: ${i.product_id})`)
    )

    // 2. Get unique, non-null product IDs
    const productIds = [...new Set(
        orderItems.map((i: any) => i.product_id).filter(Boolean)
    )] as string[]

    if (productIds.length === 0) {
        console.warn(`[AutoPlan] ⚠️  All items in order ${orderId} have NULL product_id — SKU matching failed! Check product SKUs.`)
        return
    }

    // 3. Process each product in the order
    for (const productId of productIds) {
        const { data: product, error: prodErr } = await supabase
            .from('products')
            .select(`
                id,
                product_name,
                product_type,
                product_combos:product_combos!product_combos_parent_product_id_fkey(
                    child_product_id,
                    quantity
                )
            `)
            .eq('id', productId)
            .maybeSingle()

        if (prodErr || !product) {
            console.error(`[AutoPlan] Product ${productId} not found — skipping.`, prodErr?.message)
            continue
        }

        const isCombo = product.product_type === 'combo'
        const componentsCount = (product.product_combos || []).length
        const isVariation = isCombo && componentsCount === 1

        console.log(`[AutoPlan] ── Processing: "${product.product_name}" | type=${product.product_type} | components=${componentsCount} | isVariation=${isVariation}`)

        if (isVariation) {
            // ── Type 3: Variation (combo with exactly 1 component) ────────────
            // Bypass stock check. Always create/update a Pending Confirmation plan
            // for the child component product. Remarks = parent combo product name(s).
            const comp = product.product_combos[0]
            const childProductId = comp.child_product_id

            const demand = await getActiveDemandForProduct(childProductId, supabase)
            const existingPlan = await getOrMergeActivePlans(childProductId, supabase)

            if (demand > 0) {
                // Build/append parent combo name in remarks
                let newRemarks = product.product_name
                if (existingPlan) {
                    const existingRemarks = existingPlan.remarks || ''
                    // Append if existing remarks look like product names (not system messages)
                    if (existingRemarks && !existingRemarks.startsWith('Auto-planned variation')) {
                        const names = existingRemarks.split(',').map((n: string) => n.trim()).filter(Boolean)
                        if (!names.includes(product.product_name)) {
                            names.push(product.product_name)
                        }
                        newRemarks = names.join(', ')
                    }
                }

                if (existingPlan) {
                    console.log(`[AutoPlan]   → Variation: Updating plan (id: ${existingPlan.id}) for child ${childProductId}: qty=${existingPlan.quantity}→${demand}, remarks="${newRemarks}"`)
                    const { error } = await supabase
                        .from('purchase_plans')
                        .update({
                            quantity: demand,
                            remarks: newRemarks,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingPlan.id)
                    if (error) console.error('[AutoPlan]   → Update error:', error.message)
                } else {
                    console.log(`[AutoPlan]   → Variation: Creating Pending Confirmation plan for child ${childProductId}: qty=${demand}, remarks="${newRemarks}"`)
                    const stats = await getProductPurchaseStatsInternal(childProductId, supabase)
                    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
                    const { error: insErr } = await supabase
                        .from('purchase_plans')
                        .insert({
                            plan_date: new Date().toLocaleDateString('en-CA'),
                            product_id: childProductId,
                            quantity: demand,
                            status: 'Pending Confirmation',
                            remarks: newRemarks,
                            expires_at: expiresAt,
                            snapshot_latest_price: stats.latestPrice,
                            snapshot_latest_supplier: stats.latestSupplier,
                            snapshot_low_price: stats.lowPrice,
                            snapshot_low_supplier: stats.lowSupplier,
                        })
                    if (insErr) console.error('[AutoPlan]   → Insert error:', insErr.message)
                }
            } else {
                // demand == 0: remove auto-generated plan if no active orders remain
                if (existingPlan && (existingPlan.status === 'Pending Confirmation' || existingPlan.remarks?.startsWith('Auto-planned'))) {
                    console.log(`[AutoPlan]   → Variation: demand=0, removing plan for child ${childProductId}`)
                    await supabase.from('purchase_plans').delete().eq('id', existingPlan.id)
                }
            }

        } else if (isCombo) {
            // ── Type 2: Multi-component combo ─────────────────────────────────
            // Check stock for each component against its required quantity.
            // processSingleProductAutoPlan handles needed = demand - stock.
            for (const comp of (product.product_combos || [])) {
                console.log(`[AutoPlan]   → Multi-combo component: ${comp.child_product_id} (ratio: ${comp.quantity}x)`)
                await processSingleProductAutoPlan(comp.child_product_id, supabase)
            }

        } else {
            // ── Type 1: Single product ─────────────────────────────────────────
            // Check stock. If stock <= 0 or demand > stock, add/update Pending plan.
            await processSingleProductAutoPlan(product.id, supabase)
        }
    }

    console.log(`[AutoPlan] ====== Done for order UUID: ${orderId} ======`)
}
