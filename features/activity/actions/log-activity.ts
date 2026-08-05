'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Available activity types that can be logged
 */
export type ActivityType =
    | 'login'
    | 'logout'
    | 'sale_created'
    | 'sale_updated'
    | 'product_created'
    | 'product_updated'
    | 'purchase_created'
    | 'profile_updated'
    | 'password_changed'

/**
 * Metadata that can be attached to activities
 */
export interface ActivityMetadata {
    customer_name?: string
    supplier_name?: string
    product_name?: string
    product_sku?: string
    amount?: number
    sale_id?: string
    product_id?: string
    purchase_id?: string
    [key: string]: any // Allow additional fields
}

/**
 * Log user activity to the database
 * 
 * @param action - The type of action being logged
 * @param metadata - Additional context about the action
 * @param browser - User agent string (optional)
 * @param ipAddress - User's IP address (optional)
 */
export async function logActivity(
    action: ActivityType,
    metadata?: ActivityMetadata,
    browser?: string,
    ipAddress?: string
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            // Silent fail if not authenticated
            return
        }

        await supabase.from('user_activity_logs').insert({
            user_id: user.id,
            action,
            metadata: metadata || {},
            browser,
            ip_address: ipAddress,
        })
    } catch (error) {
        // Silent fail for logging to prevent disrupting user operations
        console.error('Failed to log activity:', error)
    }
}
