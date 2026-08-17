'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Fetch distinct customer names from Daraz orders for a given date.
 * Returns an empty array if no orders are found — the caller should handle the warning.
 */
export async function getCustomerNamesForDate(date: string): Promise<string[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('daraz_orders')
        .select('customer_name')
        .eq('order_date', date)
        .not('customer_name', 'is', null)

    if (error) {
        console.error('Error fetching customer names for date:', error)
        return []
    }

    // Return distinct non-empty names
    const names = Array.from(
        new Set(
            (data || [])
                .map((row: any) => (row.customer_name as string)?.trim())
                .filter(Boolean)
        )
    )

    return names
}
