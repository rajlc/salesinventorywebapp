'use server'

import { createClient } from '@/lib/supabase/server'

export async function fixHistoricalProductLinks() {
    const supabase = await createClient()

    try {
        // 1. Fetch all active products with their SKUs, sorted by newest first
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, product_id, product_name, seller_sku1, seller_sku2, seller_sku3, seller_sku4')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })

        if (productsError) {
            return { success: false, error: `Failed to fetch products: ${productsError.message}` }
        }

        // 2. Fetch all order items (focusing on those with null or potentially incorrect product_id)
        // We'll re-match all items to ensure correctness
        const { data: orderItems, error: itemsError } = await supabase
            .from('daraz_order_items')
            .select('id, seller_sku, product_name, product_id')

        if (itemsError) {
            return { success: false, error: `Failed to fetch order items: ${itemsError.message}` }
        }

        if (!orderItems || orderItems.length === 0) {
            return { success: true, matched: 0, unmatched: 0, updated: 0, message: 'No order items to process' }
        }

        // 3. Match and update
        let matchedCount = 0
        let unmatchedCount = 0
        let updatedCount = 0
        let triggerOverrideCount = 0
        const updates: Promise<any>[] = []

        for (const item of orderItems) {
            const sellerSku = item.seller_sku?.trim()

            if (!sellerSku) {
                unmatchedCount++
                continue
            }

            // Find matching active product by SKU (robust trim check)
            const matchedProduct = products?.find(p =>
                (p.seller_sku1 && p.seller_sku1.trim() === sellerSku) ||
                (p.seller_sku2 && p.seller_sku2.trim() === sellerSku) ||
                (p.seller_sku3 && p.seller_sku3.trim() === sellerSku) ||
                (p.seller_sku4 && p.seller_sku4.trim() === sellerSku)
            )

            if (matchedProduct) {
                matchedCount++

                // Only update if product_id is different or null
                if (item.product_id !== matchedProduct.id) {
                    updatedCount++
                    updates.push(
                        (async () => {
                            const { data: updatedItem, error } = await supabase
                                .from('daraz_order_items')
                                .update({ product_id: matchedProduct.id })
                                .eq('id', item.id)
                                .select('product_id')
                                .single()

                            if (error) {
                                console.error('Update error for item', item.id, error)
                            } else if (updatedItem && updatedItem.product_id !== matchedProduct.id) {
                                // Critical: The DB accepted the update but the Trigger reverted it!
                                console.error(`Trigger Override: Expected ${matchedProduct.id}, got ${updatedItem.product_id}`)
                                triggerOverrideCount++
                            }
                        })()
                    )
                }
            } else {
                unmatchedCount++
            }
        }

        // Execute all updates in parallel
        console.log(`Migration: ${updates.length} updates queued`)
        if (updates.length > 0) {
            await Promise.all(updates)
        }

        const result = {
            success: true,
            total: orderItems.length,
            matched: matchedCount,
            unmatched: unmatchedCount,
            updated: updatedCount,
            triggerOverrides: triggerOverrideCount,
            message: triggerOverrideCount > 0
                ? `Migration WARNING: ${triggerOverrideCount} updates were REJECTED by the Database. The SQL Script 'fix_daraz_trigger' was likely not applied correctly.`
                : `Migration complete. Updated: ${updatedCount} items.`
        }

        console.log('Migration result:', result)
        return result

    } catch (error: any) {
        console.error('Migration error:', error)
        return {
            success: false,
            error: `Migration failed: ${error.message}`
        }
    }
}
