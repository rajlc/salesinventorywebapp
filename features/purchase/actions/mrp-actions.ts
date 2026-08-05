'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MrpPriceItem = {
    id: string
    product_name: string
    inventory_id?: string | null
    mrp_price: number
    applied_date: string
    created_at: string
}

export async function addMrpPrice(data: { product_name: string, inventory_id?: string | null, mrp_price: number, applied_date: string }) {
    try {
        const supabase = await createClient()
        
        // Let's resolve the inventory_id if not provided but product_name is
        let invId = data.inventory_id
        if (!invId && data.product_name) {
            const { data: inv } = await supabase
                .from('products')
                .select('id')
                .ilike('product_name', data.product_name)
                .limit(1)
                .single()
            if (inv) {
                invId = inv.id
            }
        }

        const { error } = await supabase.from('mrp_prices').insert({
            product_name: data.product_name,
            inventory_id: invId,
            mrp_price: data.mrp_price,
            applied_date: data.applied_date
        })

        if (error) {
            console.error('Failed to add MRP:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/dashboard/purchase')
        return { success: true, message: 'MRP Price saved successfully' }
    } catch (err: any) {
        console.error('Add MRP Error:', err)
        return { success: false, message: err.message || 'Unknown error' }
    }
}

export async function getLatestMrpPrices() {
    try {
        const supabase = await createClient()
        
        // We need to fetch all MRPs, but get the latest one per product.
        // We can just fetch all and group by product_name in JS, or if we have a lot, use a view.
        // For now, let's fetch ordered by applied_date desc.
        const { data, error } = await supabase
            .from('mrp_prices')
            .select('*')
            .order('applied_date', { ascending: false })
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Failed to fetch latest MRPs:', error)
            return { success: false, data: [] }
        }

        // Group by product name to find the latest
        const latestMap = new Map<string, MrpPriceItem>()
        for (const item of (data || [])) {
            const key = item.product_name.toLowerCase().trim()
            if (!latestMap.has(key)) {
                latestMap.set(key, item)
            }
        }

        return { success: true, data: Array.from(latestMap.values()) }
    } catch (err: any) {
        console.error('Get Latest MRPs Error:', err)
        return { success: false, data: [] }
    }
}

export async function getLatestMrpByProductName(productName: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('mrp_prices')
            .select('*')
            .ilike('product_name', productName)
            .order('applied_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error('Failed to fetch latest MRP for product:', error)
            return { success: false, data: null }
        }

        return { success: true, data: data || null }
    } catch (err: any) {
        console.error('Get Latest MRP by Product Error:', err)
        return { success: false, data: null }
    }
}

export async function getAllMrpPrices() {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('mrp_prices')
            .select('*')
            .order('applied_date', { ascending: false })
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Failed to fetch all MRPs:', error)
            return { success: false, data: [] }
        }

        return { success: true, data: data || [] }
    } catch (err: any) {
        console.error('Get All MRPs Error:', err)
        return { success: false, data: [] }
    }
}
