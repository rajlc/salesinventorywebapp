'use server'

import { createClient } from '@/lib/supabase/server'
import levenshtein from 'fast-levenshtein'

export interface RedirectNotification {
    id: string
    pendingOrder: {
        id: string
        sales_id: string
        branch_name: string
    }
    returningOrder: {
        id: string
        sales_id: string
        branch_name: string
    }
    matchType: 'EXACT' | 'FUZZY'
}

/**
 * Fetch notifications for potential redirects.
 * Matches 'Pending' orders with 'Returning to Seller' orders based on Branch.
 */
export async function getMarketplaceRedirectNotifications(): Promise<RedirectNotification[]> {
    const supabase = await createClient()

    // 1. Fetch all Pending orders with their branch and items
    const { data: pendingOrders, error: pendingError } = await supabase
        .from('marketplace_orders')
        .select(`
            id,
            sales_id,
            total_amount,
            delivery_branch_id,
            branch:courier_locations!fk_marketplace_courier_branch(branch_name),
            items:marketplace_order_items(product_name)
        `)
        .eq('order_status', 'Pending')
        .not('delivery_branch_id', 'is', null)

    if (pendingError) {
        console.error('Error fetching pending orders for notifications:', pendingError)
        return []
    }

    // 2. Fetch all 'Returning to Seller' orders with their branch and items
    const { data: returningOrders, error: returningError } = await supabase
        .from('marketplace_orders')
        .select(`
            id,
            sales_id,
            total_amount,
            delivery_branch_id,
            branch:courier_locations!fk_marketplace_courier_branch(branch_name),
            items:marketplace_order_items(product_name)
        `)
        .eq('order_status', 'Returning to Seller')
        .not('delivery_branch_id', 'is', null)

    if (returningError) {
        console.error('Error fetching returning orders for notifications:', returningError)
        return []
    }

    const notifications: RedirectNotification[] = []

    // 3. Find matches
    // We iterate through pending orders and look for matching returning orders
    for (const pOrder of pendingOrders) {
        // Handle branch being returned as array or object depending on relationship type
        const pBranchData = Array.isArray(pOrder.branch) ? pOrder.branch[0] : pOrder.branch
        if (!pBranchData?.branch_name) continue

        const pBranchName = pBranchData.branch_name.toLowerCase().trim()

        // Get product names for pending order
        const pProductNames = pOrder.items?.map((i: any) => i.product_name.toLowerCase().trim()) || []
        if (pProductNames.length === 0) continue

        for (const rOrder of returningOrders) {
            const rBranchData = Array.isArray(rOrder.branch) ? rOrder.branch[0] : rOrder.branch
            if (!rBranchData?.branch_name) continue

            // 3.1 Check Product Match FIRST (Crucial Step)
            const rProductNames = rOrder.items?.map((i: any) => i.product_name.toLowerCase().trim()) || []

            // Check if ANY product matches
            const hasProductMatch = pProductNames.some((pName: string) => rProductNames.includes(pName))

            if (!hasProductMatch) continue // Skip if no product match

            const rBranchName = rBranchData.branch_name.toLowerCase().trim()
            let matchType: 'EXACT' | 'FUZZY' | null = null

            // Check Exact Match (ID match is best, but Name match is what user described as fallback)
            if (pOrder.delivery_branch_id === rOrder.delivery_branch_id) {
                matchType = 'EXACT'
            }
            // Check Name Exact Match (in case IDs differ but names same)
            else if (pBranchName === rBranchName) {
                matchType = 'EXACT'
            }
            // Check Fuzzy Match
            else {
                const distance = levenshtein.get(pBranchName, rBranchName)
                // Allow distance of 1 for short strings (< 5 chars), 2 for longer
                const maxDistance = pBranchName.length < 5 ? 1 : 2

                if (distance <= maxDistance) {
                    matchType = 'FUZZY'
                }
            }

            if (matchType) {
                notifications.push({
                    id: `${pOrder.id}-${rOrder.id}`,
                    pendingOrder: {
                        id: pOrder.id,
                        sales_id: pOrder.sales_id,
                        branch_name: pBranchData.branch_name
                    },
                    returningOrder: {
                        id: rOrder.id,
                        sales_id: rOrder.sales_id,
                        branch_name: rBranchData.branch_name
                    },
                    matchType
                })
            }
        }
    }

    // Sort notifications? Maybe by pending order ID to keep check consistent?
    // Or just simple return.
    return notifications
}
