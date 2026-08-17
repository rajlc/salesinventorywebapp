'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get all currently frozen product names (global — no fiscal year scoping).
 * Returns string[] for React Query cache compatibility (caller converts to Set).
 */
export async function getFrozenProducts(): Promise<string[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('stock_frozen_products')
        .select('particulars')
        .eq('is_frozen', true)

    if (error) {
        console.error('Error fetching frozen products:', error)
        return []
    }

    return (data || []).map((row: any) => row.particulars as string)
}

/**
 * Toggle freeze state for a product (global — no fiscal year).
 * If the row doesn't exist yet, inserts it as frozen = true.
 * If it already exists, flips the is_frozen flag.
 */
export async function toggleFreezeProduct(particulars: string, freeze: boolean): Promise<void> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('stock_frozen_products')
        .upsert(
            { particulars: particulars.trim(), is_frozen: freeze, updated_at: new Date().toISOString() },
            { onConflict: 'particulars' }
        )

    if (error) {
        console.error('Error toggling freeze state:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/sales-billing')
}
