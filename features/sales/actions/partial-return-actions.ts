'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PartialReturnItem = {
    itemId: string
    currentQty: number
    returnQty: number
    sku: string
    status: string
}

export async function processPartialReturn(orderId: string, itemsToReturn: PartialReturnItem[]) {
    const supabase = await createClient()

    try {
        // 1. Validate User
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // 2. Process each item
        for (const item of itemsToReturn) {
            if (item.returnQty <= 0) continue
            if (item.returnQty > item.currentQty) {
                throw new Error(`Invalid return quantity for SKU ${item.sku}. Max: ${item.currentQty}`)
            }

            // Case A: Full Item Return (e.g. Qty 1 -> Return 1, or Qty 5 -> Return 5)
            if (item.returnQty === item.currentQty) {
                const { error } = await supabase
                    .from('daraz_order_items')
                    .update({
                        item_status: item.status
                    })
                    .eq('id', item.itemId)

                if (error) throw new Error(`Failed to update item ${item.sku}: ${error.message}`)
            }
            // Case B: Partial Split (e.g. Qty 2 -> Return 1, Keep 1)
            else {
                const keepQty = item.currentQty - item.returnQty

                // 1. Update existing row to represent the KEPT quantity (Status remains same, probably Delivered)
                // We don't change status here, just reducing Qty
                const { error: updateError } = await supabase
                    .from('daraz_order_items')
                    .update({
                        quantity: keepQty,
                        // Update aggregation key to prevent future sync merges if necessary, though sync should handle by ID + status now
                    })
                    .eq('id', item.itemId)

                if (updateError) throw new Error(`Failed to update split item ${item.sku}: ${updateError.message}`)

                // 2. Fetch the original item to copy data
                const { data: originalItem, error: fetchError } = await supabase
                    .from('daraz_order_items')
                    .select('*')
                    .eq('id', item.itemId)
                    .single()

                if (fetchError || !originalItem) throw new Error('Failed to fetch original item for splitting')

                // Prepare data for insertion (remove ID and system fields)
                const { id: _id, created_at: _created, ...itemData } = originalItem

                // 3. Insert NEW row for the RETURNED quantity
                const { error: insertError } = await supabase
                    .from('daraz_order_items')
                    .insert({
                        ...itemData,
                        quantity: item.returnQty,
                        item_status: item.status, // The Return Status
                        item_sequence: (originalItem.item_sequence || 0) + 1,
                        // Aggregation key removed as it is not a DB column
                    })

                if (insertError) throw new Error(`Failed to insert split return item ${item.sku}: ${insertError.message}`)
            }
        }

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        revalidatePath('/dashboard/inventory/stock-ledger')

        return { success: true }
    } catch (error: any) {
        console.error('Partial Return Error:', error)
        return { success: false, error: error.message }
    }
}
