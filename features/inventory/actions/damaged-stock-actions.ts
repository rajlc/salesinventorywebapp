'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** One individual damage recording event (a row in damaged_stocks) */
export interface DamagedStockEvent {
    id: string
    date: string
    quantity: number  // stored as negative in DB (e.g. -5 means 5 damaged)
    location: string
    remarks?: string
    created_at: string
}

/** A resolution entry against a product's damage pool */
export interface DamageResolution {
    id: string
    product_id: string
    date: string
    resolved_qty: number  // always positive
    resolution_type: 'Repaired' | 'Exchanged' | 'Non-Repairable'
    remarks?: string
    created_at: string
    updated_at: string
}

/** Aggregated view of one product's total damage state (used in UI) */
export interface DamagedProductSummary {
    product_id: string
    product_name: string
    product_custom_id: string
    /** Individual damage events (one per Add Damage action) */
    events: DamagedStockEvent[]
    /** Total ever damaged across all events (positive number) */
    total_damaged: number
    /** Units confirmed repaired → return to stock */
    repaired_qty: number
    /** Units confirmed exchanged by supplier → return to stock */
    exchanged_qty: number
    /** Units permanently lost / written off → stay as damage */
    non_repairable_qty: number
    /** repaired + exchanged + non_repairable */
    total_resolved: number
    /** total_damaged - total_resolved (stock deduction amount) */
    remaining_qty: number
    /** All resolution entries for this product */
    resolutions: DamageResolution[]
    /** Date of the most recent damage event */
    latest_damage_date: string
}

/** Legacy type kept for backward compatibility */
export interface DamagedStock {
    id: string
    date: string
    location: string
    product_id: string
    product_name?: string
    product_custom_id?: string
    quantity: number
    status: 'Damaged' | 'Repair' | 'Exchange'
    remarks?: string
    created_at: string
    updated_at: string
}

// ─────────────────────────────────────────────────────────────
// SAVE DAMAGED STOCK (add a new damage event for a product)
// ─────────────────────────────────────────────────────────────

export async function saveDamagedStock(data: {
    date: string
    location: string
    product_id: string
    quantity: number  // pass positive; function stores as negative
    remarks?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('damaged_stocks')
        .insert({
            date: data.date,
            location: data.location,
            product_id: data.product_id,
            quantity: -Math.abs(data.quantity), // always stored as negative
            status: 'Damaged',
            remarks: data.remarks
        })

    if (error) {
        console.error('Error saving damaged stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// ─────────────────────────────────────────────────────────────
// GET AGGREGATED PRODUCT SUMMARIES
// Returns one entry per product with all events + all resolutions
// ─────────────────────────────────────────────────────────────

export async function getDamagedProductSummaries(): Promise<DamagedProductSummary[]> {
    const supabase = await createClient()

    // Fetch all damage events (status = 'Damaged' only)
    const { data: events, error: eventsError } = await supabase
        .from('damaged_stocks')
        .select(`
            *,
            products (
                product_name,
                product_id
            )
        `)
        .eq('status', 'Damaged')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (eventsError) {
        console.error('Error fetching damaged stocks:', eventsError)
        throw new Error(eventsError.message)
    }

    // Fetch all resolution records
    const { data: resolutions, error: resError } = await supabase
        .from('damage_resolutions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (resError) {
        console.error('Error fetching damage resolutions:', resError)
        throw new Error(resError.message)
    }

    // ── Group events by product ──
    const productMap = new Map<string, DamagedProductSummary>()

    for (const event of (events || [])) {
        const productId = event.product_id
        const productName = event.products?.product_name || 'Unknown Product'
        const productCustomId = event.products?.product_id ? String(event.products.product_id) : '-'

        if (!productMap.has(productId)) {
            productMap.set(productId, {
                product_id: productId,
                product_name: productName,
                product_custom_id: productCustomId,
                events: [],
                total_damaged: 0,
                repaired_qty: 0,
                exchanged_qty: 0,
                non_repairable_qty: 0,
                total_resolved: 0,
                remaining_qty: 0,
                resolutions: [],
                latest_damage_date: event.date
            })
        }

        const summary = productMap.get(productId)!
        summary.events.push({
            id: event.id,
            date: event.date,
            quantity: event.quantity,
            location: event.location,
            remarks: event.remarks,
            created_at: event.created_at
        })
        summary.total_damaged += Math.abs(event.quantity)

        // Track the most recent damage date
        if (event.date > summary.latest_damage_date) {
            summary.latest_damage_date = event.date
        }
    }

    // ── Add resolution data ──
    for (const res of (resolutions || [])) {
        const summary = productMap.get(res.product_id)
        if (!summary) continue  // resolution for a product no longer in damage list

        summary.resolutions.push(res as DamageResolution)

        switch (res.resolution_type) {
            case 'Repaired':
                summary.repaired_qty += res.resolved_qty
                break
            case 'Exchanged':
                summary.exchanged_qty += res.resolved_qty
                break
            case 'Non-Repairable':
                summary.non_repairable_qty += res.resolved_qty
                break
        }
    }

    // ── Compute derived totals ──
    for (const summary of productMap.values()) {
        summary.total_resolved = summary.repaired_qty + summary.exchanged_qty + summary.non_repairable_qty
        summary.remaining_qty = Math.max(0, summary.total_damaged - summary.total_resolved)
    }

    // Sort: active damage first (remaining > 0), then by latest damage date desc
    return Array.from(productMap.values()).sort((a, b) => {
        if (a.remaining_qty > 0 && b.remaining_qty === 0) return -1
        if (a.remaining_qty === 0 && b.remaining_qty > 0) return 1
        return new Date(b.latest_damage_date).getTime() - new Date(a.latest_damage_date).getTime()
    })
}

// ─────────────────────────────────────────────────────────────
// CHECK EXISTING REMAINING DAMAGE FOR A PRODUCT
// Used in Add Damage modal to show warning if product already has damage
// ─────────────────────────────────────────────────────────────

export async function getProductRemainingDamage(productId: string): Promise<number> {
    const supabase = await createClient()

    const [eventsResult, resResult] = await Promise.all([
        supabase
            .from('damaged_stocks')
            .select('quantity')
            .eq('product_id', productId)
            .eq('status', 'Damaged'),
        supabase
            .from('damage_resolutions')
            .select('resolved_qty')
            .eq('product_id', productId)
    ])

    const totalDamaged = (eventsResult.data || []).reduce((sum, e) => sum + Math.abs(e.quantity), 0)
    const totalResolved = (resResult.data || []).reduce((sum, r) => sum + r.resolved_qty, 0)

    return Math.max(0, totalDamaged - totalResolved)
}

// ─────────────────────────────────────────────────────────────
// SAVE DAMAGE RESOLUTION
// ─────────────────────────────────────────────────────────────

export async function saveDamageResolution(data: {
    product_id: string
    date: string
    resolved_qty: number
    resolution_type: 'Repaired' | 'Exchanged' | 'Non-Repairable'
    remarks?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('damage_resolutions')
        .insert({
            product_id: data.product_id,
            date: data.date,
            resolved_qty: data.resolved_qty,
            resolution_type: data.resolution_type,
            remarks: data.remarks || null
        })

    if (error) {
        console.error('Error saving damage resolution:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// ─────────────────────────────────────────────────────────────
// UPDATE DAMAGE RESOLUTION (edit qty / date / remarks)
// ─────────────────────────────────────────────────────────────

export async function updateDamageResolution(id: string, data: {
    resolved_qty?: number
    date?: string
    remarks?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('damage_resolutions')
        .update({
            ...data,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating damage resolution:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// ─────────────────────────────────────────────────────────────
// DELETE DAMAGE RESOLUTION
// ─────────────────────────────────────────────────────────────

export async function deleteDamageResolution(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('damage_resolutions')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting damage resolution:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// ─────────────────────────────────────────────────────────────
// DELETE ALL DAMAGE RECORDS FOR A PRODUCT
// Blocked if remaining_qty > 0 (enforced server-side)
// ─────────────────────────────────────────────────────────────

export async function deleteDamagedProduct(productId: string) {
    const supabase = await createClient()

    // Server-side guard: verify remaining_qty = 0 before allowing deletion
    const remaining = await getProductRemainingDamage(productId)
    if (remaining > 0) {
        throw new Error(
            `Cannot delete: ${remaining} unit(s) still unresolved. Resolve all damage before deleting.`
        )
    }

    // Delete resolutions first (FK constraint)
    const { error: resErr } = await supabase
        .from('damage_resolutions')
        .delete()
        .eq('product_id', productId)

    if (resErr) throw new Error(resErr.message)

    // Delete all damage events for this product
    const { error: evtErr } = await supabase
        .from('damaged_stocks')
        .delete()
        .eq('product_id', productId)
        .eq('status', 'Damaged')

    if (evtErr) throw new Error(evtErr.message)

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// ─────────────────────────────────────────────────────────────
// LEGACY HELPERS (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────

export async function getDamagedStocks() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('damaged_stocks')
        .select(`*, products(product_name, product_id)`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data.map((item: any) => ({
        ...item,
        product_name: item.products?.product_name || 'Unknown Product',
        product_custom_id: item.products?.product_id ? String(item.products.product_id) : '-'
    })) as DamagedStock[]
}

export async function updateDamagedStock(id: string, data: Partial<DamagedStock>) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('damaged_stocks')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/inventory/damaged-stocks')
}

export async function deleteDamagedStock(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('damaged_stocks')
        .delete()
        .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/inventory/damaged-stocks')
}
