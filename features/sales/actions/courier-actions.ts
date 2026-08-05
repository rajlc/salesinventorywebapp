'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- Types ---
type PathaoCity = { city_id: number; city_name: string }
type PathaoZone = { zone_id: number; zone_name: string }
type PathaoArea = { area_id: number; area_name: string }
type PriceCalculationPayload = {
    price: number;
    discount: number;
    promo_discount: number;
    plan_id: number;
    cod_percentage: number;
    additional_charge: number;
    final_price: number;
}
type CreateOrderPayload = {
    store_id: number;
    merchant_order_id: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    recipient_city: number;
    recipient_zone: number;
    recipient_area: number;
    delivery_type: number; // 48 Normal, 12 Express
    item_type: number; // 1 Doc, 2 Parcel
    special_instruction?: string;
    item_quantity: number;
    item_weight: number;
    item_description?: string;
    amount_to_collect: number;
}

// --- Helper: Get Access Token ---
async function getPathaoToken(supabase: any): Promise<{ accessToken: string; baseUrl: string } | null> {
    const { data: settings } = await supabase
        .from('courier_api_settings')
        .select('*')
        .eq('provider', 'pathao')
        .single()

    if (!settings) return null

    // Check if token is expired
    if (new Date(settings.token_expires_at) < new Date()) {
        const response = await fetch(`${settings.base_url}/aladdin/api/v1/issue-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: settings.client_id,
                client_secret: settings.client_secret,
                grant_type: 'password', // Simpler to just re-login for now
                username: settings.username,
                password: settings.password,
            }),
        })

        if (!response.ok) {
            console.error('Failed to refresh Pathao token')
            return null
        }

        const data = await response.json()
        const newExpiry = new Date(Date.now() + data.expires_in * 1000)

        // Save new token
        await supabase
            .from('courier_api_settings')
            .update({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                token_expires_at: newExpiry.toISOString(),
            })
            .eq('id', settings.id)

        return { accessToken: data.access_token, baseUrl: settings.base_url }
    }

    return { accessToken: settings.access_token, baseUrl: settings.base_url }
}


// --- Actions ---

export async function getPathaoCities(): Promise<PathaoCity[]> {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return []

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/city-list`, {
            headers: { 'Authorization': `Bearer ${creds.accessToken}` }
        })
        const result = await response.json()
        return result?.data?.data || []
    } catch (e) {
        console.error('Error fetching cities:', e)
        return []
    }
}

export async function getPathaoZones(cityId: number): Promise<PathaoZone[]> {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return []

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`, {
            headers: { 'Authorization': `Bearer ${creds.accessToken}` }
        })
        const result = await response.json()
        return result?.data?.data || []
    } catch (e) {
        console.error('Error fetching zones:', e)
        return []
    }
}

export async function getPathaoAreas(zoneId: number): Promise<PathaoArea[]> {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return []

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/zones/${zoneId}/area-list`, {
            headers: { 'Authorization': `Bearer ${creds.accessToken}` }
        })
        const result = await response.json()
        return result?.data?.data || []
    } catch (e) {
        console.error('Error fetching areas:', e)
        return []
    }
}

export async function getPathaoStoreId(): Promise<number | null> {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return null

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/stores`, {
            headers: { 'Authorization': `Bearer ${creds.accessToken}` }
        })
        const result = await response.json()
        // Return first active store
        const store = result?.data?.data?.[0]
        return store ? store.store_id : null
    } catch (e) {
        console.error('Error fetching store info:', e)
        return null
    }
}


export async function calculatePathaoPrice(payload: any) {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return { error: 'Invalid credentials' }

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/merchant/price-plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.accessToken}`
            },
            body: JSON.stringify(payload)
        })
        const result = await response.json()
        if (result.type !== 'success') {
            return { error: result.message || 'Failed to calculate price' }
        }
        return { data: result.data }
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function createPathaoOrder(payload: CreateOrderPayload, internalOrderId: string) {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return { error: 'Invalid credentials' }

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.accessToken}`
            },
            body: JSON.stringify(payload)
        })
        const result = await response.json()

        if (result.type === 'success') {
            const consignmentId = result.data.consignment_id

            // Update internal DB
            await supabase
                .from('daraz_orders')
                .update({
                    courier_provider: 'pathao',
                    courier_consignment_id: consignmentId,
                    courier_status: 'Pending'
                })
                .eq('id', internalOrderId)

            revalidatePath('/dashboard/sales/marketplace')
            return { success: true, consignment_id: consignmentId }
        } else {
            // Check for specific validation errors
            const errorMsg = result.errors ? JSON.stringify(result.errors) : result.message
            return { error: errorMsg || 'Failed to create order' }
        }

    } catch (e: any) {
        return { error: e.message }
    }
}

export async function trackOrder(orderId: string) {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return { error: 'Invalid credentials' }

    // Get order details
    const { data: order } = await supabase.from('daraz_orders').select('courier_consignment_id').eq('id', orderId).single()

    if (!order?.courier_consignment_id) return { error: 'No consignment ID' }

    try {
        const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders/${order.courier_consignment_id}/info`, {
            headers: { 'Authorization': `Bearer ${creds.accessToken}` }
        })
        const result = await response.json()

        if (result.type === 'success') {
            const status = result.data.order_status

            await supabase
                .from('daraz_orders')
                .update({ courier_status: status })
                .eq('id', orderId)

            revalidatePath('/dashboard/sales/marketplace')
            return { success: true, status }
        }
        return { error: 'Failed to fetch status' }

    } catch (e: any) {
        return { error: e.message }
    }
}

export async function syncAllCourierStatuses() {
    const supabase = await createClient()
    const creds = await getPathaoToken(supabase)
    if (!creds) return { error: 'Invalid credentials' }

    // Get all orders that are NOT delivered or cancelled
    const { data: orders } = await supabase
        .from('daraz_orders')
        .select('id, courier_consignment_id')
        .eq('courier_provider', 'pathao')
        .not('courier_consignment_id', 'is', null)
        // Example filter: .not('courier_status', 'in', '("Delivered","Cancel")') - adjusting syntax for supabase 'in'
        .neq('courier_status', 'Delivered')
        .neq('courier_status', 'Cancel')

    if (!orders || orders.length === 0) return { success: true, message: 'No orders to sync' }

    let updatedCount = 0

    // Sequential for now to avoid complexity/limits, or Promise.all for speed
    // Pathao might rate limit if we spam, but for small volume Promise.all is okay.
    // Let's do batches of 5.

    const batchSize = 5
    for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize)
        await Promise.all(batch.map(async (order) => {
            try {
                const url = `${creds.baseUrl}/aladdin/api/v1/orders/${order.courier_consignment_id}/info`
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${creds.accessToken}` } })
                const json = await res.json()

                if (json.type === 'success') {
                    const status = json.data.order_status
                    await supabase
                        .from('daraz_orders')
                        .update({ courier_status: status })
                        .eq('id', order.id)
                    updatedCount++
                }
            } catch (e) {
                console.error(`Error syncing order ${order.id}`, e)
            }
        }))
    }

    revalidatePath('/dashboard/sales/marketplace')
    return { success: true, count: updatedCount }
}
