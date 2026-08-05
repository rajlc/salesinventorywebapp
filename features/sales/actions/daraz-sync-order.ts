import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import axios from 'axios'
import { revalidatePath } from 'next/cache'
import { syncOrderPurchaseCost } from './report-actions'
import { autoPlanPurchaseForOrder } from '@/features/purchase/actions/auto-plan-utils'

// Helper: Sign Daraz API Requests
export function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// Helper: Determine highest priority status from a list
export function getProminentStatus(statuses: string[]): string {
    if (!statuses || statuses.length === 0) return 'Pending'

    const s = statuses.map(x => x.toLowerCase())

    if (s.includes('unpaid')) return 'Unpaid'

    if (s.includes('returned') || s.includes('customer_return_delivered')) return 'Customer Return Delivered'
    if (s.includes('shipped_back_success') || s.includes('returned_delivered')) return 'Returned Delivered'
    if (s.includes('customer_return')) return 'Customer Return'

    if (s.includes('returning_to_seller') || s.includes('returning to seller') || s.includes('shipped_back') ||
        s.includes('failed_delivery') || s.includes('failed_delivered') || s.includes('delivery_failed') ||
        s.includes('delivery failed') || s.includes('failed')) return 'Returning to Seller'

    if (s.includes('delivered') || s.includes('completed')) return 'Delivered'
    if (s.includes('shipped')) return 'Shipped'
    if (s.includes('ready_to_ship') || s.includes('ready to ship')) return 'Ready to Ship'
    if (s.includes('packed')) return 'Packed'

    if (s.includes('pending')) return 'Pending'

    if (s.includes('canceled') || s.includes('cancelled')) return 'Cancel'

    return 'Pending'
}

// Helper: Generate deterministic UUID from strings
function generateDeterministicId(seed: string): string {
    const hash = crypto.createHash('sha256').update(seed).digest('hex')
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

/**
 * Fetches the latest data for a single Daraz order and updates the local database.
 * This is used by both the manual "Refresh" button and the automated Webhook.
 */
export async function syncSingleDarazOrderAction(orderId: string, storeId: string) {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_APP_SECRET?.trim()
    const apiUrl = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    const supabase = await createAdminClient()

    // Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .maybeSingle()

    if (dbError || !tokenData) {
        throw new Error(`No active connection found for store: ${storeId}. Please connect your Daraz account for Orders.`)
    }

    try {
        const timestamp = new Date().getTime()

        // 1. Fetch single order details
        const params: Record<string, any> = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: timestamp,
            sign_method: 'sha256',
            order_id: orderId
        }

        const apiPath = '/order/get'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[DarazSync] Syncing order ${orderId}...`)
        const response = await axios.get(`${apiUrl}${apiPath}`, { params })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        const order = response.data.data
        if (!order) throw new Error('Order not found in Daraz')

        // 2. Fetch items for this order
        const itemTimestamp = new Date().getTime()
        const itemParams: Record<string, any> = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: itemTimestamp,
            sign_method: 'sha256',
            order_id: orderId
        }
        itemParams.sign = signRequest('/order/items/get', itemParams, appSecret)

        const itemRes = await axios.get(`${apiUrl}/order/items/get`, { params: itemParams })
        const items = itemRes.data.data || []

        // 3. Determine status
        const itemStatuses = items.map((i: any) => i.status).filter(Boolean)
        const orderStatuses = order.statuses || (order.status ? [order.status] : [])
        const allStatuses = Array.from(new Set([...orderStatuses, ...itemStatuses]))
        const newStatus = getProminentStatus(allStatuses as string[])

        // 4. Prepare for Upsert
        const { data: existingOrder } = await supabase
            .from('daraz_orders')
            .select('id, invoice_number')
            .eq('order_id', orderId)
            .single()

        let invoiceNumber = existingOrder?.invoice_number
        if (!invoiceNumber) {
            const { data: invData, error: invErr } = await supabase.rpc('generate_daraz_invoice_number')
            if (!invErr) invoiceNumber = invData
        }

        const shipping = typeof order.address_shipping === 'string' ? JSON.parse(order.address_shipping || '{}') : order.address_shipping || {}
        const billing = typeof order.address_billing === 'string' ? JSON.parse(order.address_billing || '{}') : order.address_billing || {}

        let trackingCode: string | null = null
        if (!['pending', 'unpaid', 'canceled'].includes(newStatus.toLowerCase())) {
            const codes = new Set<string>()
            if (order.tracking_code) codes.add(order.tracking_code)
            if (items && Array.isArray(items)) {
                items.forEach((i: any) => {
                    const code = i.tracking_code || i.trackingCode || i.tracking_number || i.package_id
                    if (code) codes.add(String(code))
                })
            }
            trackingCode = codes.size > 0 ? Array.from(codes).join(', ') : null
        }

        const upsertPayload: any = {
            order_id: String(orderId),
            order_number: String(order.order_number),
            store_id: storeId,
            order_status: newStatus,
            statuses: allStatuses,
            items_detail: items,
            daraz_updated_at: order.updated_at,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            invoice_number: invoiceNumber,
            deleted: false,
            customer_first_name: order.customer_first_name,
            customer_last_name: order.customer_last_name,
            shipping_name: shipping.first_name || shipping.firstName || shipping.name || order.customer_first_name || 'N/A',
            shipping_address: shipping.address1 || shipping.address2 || billing.address1 || '',
            shipping_city: shipping.city || shipping.City,
            shipping_postcode: shipping.post_code || shipping.postCode || shipping.PostCode,
            shipping_phone: shipping.phone || shipping.Phone || null,
            tracking_code: trackingCode,
            tracking_number: trackingCode,
            customer_name: shipping.first_name || shipping.firstName || shipping.name || order.customer_name || order.customer_first_name || 'Guest',
            price: order.price,
            items_count: order.items_count,
            daraz_created_at: order.created_at,
            order_date: order.created_at,
            order_source: 'sync'
        }

        if (newStatus === 'Delivered') {
            const eventTime = order.updated_at ? new Date(order.updated_at).toISOString() : new Date().toISOString()
            upsertPayload.delivered_by_daraz = eventTime
            upsertPayload.delivered_at = eventTime
            upsertPayload.delivered_by_name = 'Daraz sync'
        }

        if (newStatus === 'Returned Delivered') {
            const eventTime = order.updated_at ? new Date(order.updated_at).toISOString() : new Date().toISOString()
            upsertPayload.returned_delivered_at = eventTime
            upsertPayload.returned_delivered_by_name = 'Daraz sync'
        }

        if (newStatus === 'Shipped') {
            upsertPayload.shipped_by_name = 'Daraz sync'
        }

        const { data: initialSavedOrder, error: saveError } = await supabase
            .from('daraz_orders')
            .upsert(upsertPayload, { onConflict: 'order_id' })
            .select()
            .single()

        let savedOrder = initialSavedOrder;
        if (saveError) {
             if (saveError.code === '23505' && saveError.message.includes('invoice_number_key')) {
                 // Collision on single insert. Append a random suffix to bypass Next.js cache and guarantee uniqueness
                 const randAppendix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                 upsertPayload.invoice_number = `${invoiceNumber}-${randAppendix}`;
                 console.log(`[DarazSync] Invoice collision detected for order ${order.order_number}. Retrying with: ${upsertPayload.invoice_number}`);
                 
                 const { data: retrySavedOrder, error: retrySaveError } = await supabase
                      .from('daraz_orders')
                      .upsert(upsertPayload, { onConflict: 'order_id' })
                      .select()
                      .single()
                 
                 if (retrySaveError) throw new Error(`Failed to save order on retry: ${retrySaveError.message}`)
                 savedOrder = retrySavedOrder
             } else {
                 throw new Error(`Failed to save order: ${saveError.message}`)
             }
        }

        // 5. Sync items for reports
        if (items.length > 0 && savedOrder) {
            const { data: products } = await supabase
                .from('products')
                .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name, seller_account')
                .limit(10000)

            const skuMap = new Map<string, any>()
            const nameMap = new Map<string, any>()

            products?.forEach(p => {
                if (p.seller_sku1) skuMap.set(p.seller_sku1.toLowerCase(), p)
                if (p.seller_sku2) skuMap.set(p.seller_sku2.toLowerCase(), p)
                if (p.seller_sku3) skuMap.set(p.seller_sku3.toLowerCase(), p)
                if (p.seller_sku4) skuMap.set(p.seller_sku4.toLowerCase(), p)
                if (p.product_name) nameMap.set(p.product_name.toLowerCase().trim(), p)
            })

            const itemsToSync = items.filter((item: any) => {
                const s = (item.status || '').toLowerCase()
                return !['unpaid', 'canceled', 'cancelled'].includes(s)
            })

            if (itemsToSync.length > 0) {
                // [RACE CONDITION FIX] Instead of deleting all, we use deterministic IDs and upsert.
                // This prevents parallel processes from clearing and then doubling the items.
                const orderItemsPayload = []
                let sequence = 1

                for (const item of itemsToSync) {
                    const sku = item.sku || item.Sku || item.shop_sku || item.ShopSku || ''
                    const itemName = (item.name || '').toLowerCase().trim()

                    let matchedProduct = skuMap.get(sku.toLowerCase())
                    if (!matchedProduct && itemName) matchedProduct = nameMap.get(itemName)

                    orderItemsPayload.push({
                        id: undefined as string | undefined,
                        order_id: savedOrder.id,
                        seller_sku: sku,
                        product_id: matchedProduct?.id || null,
                        product_name: matchedProduct?.product_name || item.name || 'Unknown Product',
                        seller_account: matchedProduct?.seller_account || 'Unknown',
                        quantity: 1,
                        amount: item.item_price || item.price || 0,
                        status: item.status || 'pending',
                        item_status: item.status || 'pending',
                        item_sequence: sequence++
                    })
                }

                if (orderItemsPayload.length > 0) {
                    const aggregatedItems = new Map<string, any>()
                    orderItemsPayload.forEach(p => {
                        const key = `${p.seller_sku}_${p.amount}`
                        if (aggregatedItems.has(key)) {
                            const existing = aggregatedItems.get(key)
                            existing.quantity += 1
                            // Keep the higher priority status if they differ
                            existing.status = getProminentStatus([existing.status, p.status])
                            existing.item_status = existing.status
                        } else {
                            // Generate deterministic ID for this item group within this order
                            // We EXCLUDE status from the ID seed so the ID stays the same even if status changes
                            p.id = generateDeterministicId(`order-${savedOrder.id}-sku-${p.seller_sku}-amt-${p.amount}`)
                            aggregatedItems.set(key, p)
                        }
                    })

                    const finalItems = Array.from(aggregatedItems.values())
                    const finalIds = finalItems.map(i => i.id)

                    // 1. Upsert items (this is idempotent)
                    await supabase.from('daraz_order_items').upsert(finalItems)

                    // 2. Cleanup orphaned items for this order that are no longer in the payload
                    await supabase.from('daraz_order_items')
                        .delete()
                        .eq('order_id', savedOrder.id)
                        .not('id', 'in', `(${finalIds.join(',')})`)
                }
            } else {
                // If there are no items to sync (e.g. order cancelled), clear existing ones
                await supabase.from('daraz_order_items').delete().eq('order_id', savedOrder.id)
            }

            // Trigger automatic purchase planning based on current stock & active order demand
            try {
                await autoPlanPurchaseForOrder(savedOrder.id)
            } catch (autoPlanError: any) {
                console.error(`[DarazSync] Auto-purchase-plan FAILED for order ${savedOrder.id}:`, autoPlanError.message)
            }
        }

        // 6. AUTO-SYNC PROFIT: If delivered, trigger financial sync (fees + costs) after 3 min delay
        if (newStatus === 'Delivered') {
            const ordNum = String(order.order_number)
            console.log(`[DarazSync] Order ${ordNum} Delivered. Scheduling profit sync in 3 minutes...`)

            // We use a non-awaited setTimeout to allow the request to COMPLETE and RETURN to the user/webhook
            // while the sync runs in the background.
            setTimeout(async () => {
                try {
                    // Re-importing inside the closure if needed, but since it's an exported function from this file or imported, it should work.
                    // Actually syncOrderPurchaseCost is imported at the top of the file.
                    await syncOrderPurchaseCost(ordNum)
                    console.log(`[DarazSync] Delayed Auto-profit-sync TRIGGERED for: ${ordNum}`)
                } catch (syncErr: any) {
                    console.error(`[DarazSync] Delayed Auto-profit-sync FAILED for ${ordNum}:`, syncErr.message)
                }
            }, 180000) // 3 minutes = 180,000ms
        }

        revalidatePath('/dashboard/sales/daraz')
        return { success: true, newStatus }

    } catch (error: any) {
        console.error(`[DarazSync] Failed to sync order ${orderId}:`, error.message)
        throw error
    }
}
