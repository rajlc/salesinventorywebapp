import { getDB } from '@/lib/db/indexed-db'
import { addToSyncQueue } from '@/lib/db/sync-manager'
import { supabase } from '@/lib/supabase/client'

/**
 * Cache purchase plans to IndexedDB for offline access
 */
export async function cachePurchasePlans(plans: any[]) {
    const db = await getDB()
    const tx = db.transaction('purchase_plans', 'readwrite')

    for (const plan of plans) {
        // Store complete plan data for reconstruction
        await tx.store.put({
            id: plan.id,
            product_id: plan.product_id,
            product_name: plan.product?.product_name || '',
            quantity: plan.quantity,
            unit: plan.unit || 'pcs',
            notes: plan.remarks,
            created_at: plan.created_at,
            completed: plan.status === 'Complete',
            last_synced: Date.now(),
            // Store full plan for exact reconstruction
            _full_plan: JSON.stringify(plan),
        })
    }

    await tx.done
    console.log(`✅ Cached ${plans.length} purchase plans`)
}

/**
 * Get cached purchase plans from IndexedDB
 * Returns reconstructed PurchasePlan objects
 */
export async function getCachedPurchasePlans() {
    const db = await getDB()
    const cachedPlans = await db.getAll('purchase_plans')

    // Reconstruct full plans
    return cachedPlans.map((cached: any) => {
        if (cached._full_plan) {
            try {
                return JSON.parse(cached._full_plan)
            } catch (e) {
                console.error('Failed to parse cached plan:', e)
            }
        }
        // Fallback: minimal plan structure
        return {
            id: cached.id,
            product_id: cached.product_id,
            plan_date: new Date().toISOString().split('T')[0],
            quantity: cached.quantity,
            status: cached.completed ? 'Complete' : 'Pending',
            product: {
                product_name: cached.product_name,
                image_url: null,
                product_type: 'single' as const,
                seller_sku1: '',
                seller_sku2: '',
                seller_sku3: '',
                seller_sku4: '',
            },
            remarks: cached.notes,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            created_at: cached.created_at,
            snapshot_latest_price: 0,
            snapshot_latest_supplier: '',
            snapshot_low_price: 0,
            snapshot_low_supplier: '',
        }
    })
}

/**
 * Add purchase offline - stores in IndexedDB and queues for sync
 */
export async function addPurchaseOffline(purchaseData: {
    product_id: string
    supplier_id?: string
    quantity: number
    unit_price: number
    total_amount: number
    purchase_date: string
    notes?: string
}) {
    const db = await getDB()

    // Generate local ID
    const localId = crypto.randomUUID()

    // Store in IndexedDB
    await db.put('purchases', {
        id: localId,
        ...purchaseData,
        created_at: new Date().toISOString(),
        synced: false,
    })

    // Add to sync queue
    await addToSyncQueue({
        operation_type: 'add_purchase',
        entity_type: 'purchase',
        entity_id: localId,
        data: purchaseData,
    })

    console.log('✅ Purchase added offline:', localId)
    return localId
}

/**
 * Mark plan as complete offline
 */
export async function markPlanCompleteOffline(planId: string) {
    const db = await getDB()
    const plan = await db.get('purchase_plans', planId)

    if (!plan) {
        throw new Error('Plan not found')
    }

    // Update in IndexedDB
    await db.put('purchase_plans', {
        ...plan,
        completed: true,
        last_synced: Date.now(),
    })

    // Add to sync queue
    await addToSyncQueue({
        operation_type: 'complete_plan',
        entity_type: 'plan',
        entity_id: planId,
        data: { completed: true },
    })

    console.log('✅ Plan marked complete offline:', planId)
}

/**
 * Sync purchases from Supabase and cache them
 * This runs when online to populate offline cache
 */
export async function syncPurchasesFromServer(date?: string) {
    try {
        const targetDate = date || new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('purchases')
            .select('*')
            .gte('purchase_date', targetDate)
            .lte('purchase_date', targetDate)

        if (error) throw error

        // Cache to IndexedDB
        if (data && data.length > 0) {
            const db = await getDB()
            const tx = db.transaction('purchases', 'readwrite')

            for (const purchase of data) {
                await tx.store.put({
                    ...purchase,
                    synced: true,
                    server_id: purchase.id,
                })
            }

            await tx.done
            console.log(`✅ Synced and cached ${data.length} purchases`)
        }

        return data
    } catch (error) {
        console.error('Error syncing purchases:', error)
        return []
    }
}

/**
 * Get purchases (from cache if offline, from server if online)
 */
export async function getPurchasesOfflineFirst(date?: string) {
    // Try to fetch from server first if online
    if (typeof window !== 'undefined' && navigator.onLine) {
        const serverData = await syncPurchasesFromServer(date)
        if (serverData && serverData.length > 0) {
            return serverData
        }
    }

    // Fall back to IndexedDB cache
    const db = await getDB()
    const targetDate = date || new Date().toISOString().split('T')[0]

    const allPurchases = await db.getAll('purchases')
    const filtered = allPurchases.filter(p =>
        p.purchase_date === targetDate
    )

    console.log(`📦 Loaded ${filtered.length} purchases from offline cache`)
    return filtered
}
