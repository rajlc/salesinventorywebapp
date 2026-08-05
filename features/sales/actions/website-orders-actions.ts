'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface GetWebsiteOrdersFilters {
    search?: string
    status?: string
    limit?: number
}

export async function getWebsiteOrders(filters: GetWebsiteOrdersFilters = {}) {
    const supabase = await createClient()

    let query = supabase
        .from('website_orders')
        .select(`
            *,
            items:website_order_items(*)
        `)
        .order('created_at', { ascending: false })

    if (filters.status && filters.status !== 'All') {
        query = query.eq('order_status', filters.status)
    }

    if (filters.search) {
        query = query.or(`sales_id.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`)
    }

    if (filters.limit) {
        query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching website orders:', error)
        throw new Error('Failed to fetch website orders')
    }

    return { orders: data || [] }
}
