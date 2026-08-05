import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import axios from 'axios'
import { syncOrderPurchaseCost } from '@/features/sales/actions/report-actions'

export const dynamic = 'force-dynamic'

function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// Helper: Determine highest priority status from a list
function getProminentStatus(statuses: string[]): string {
    if (!statuses || statuses.length === 0) return 'Pending'

    const s = statuses.map(x => x.toLowerCase())

    // Priority 0: Unpaid (Highest priority if we want to show it distinctly)
    if (s.includes('unpaid')) return 'Unpaid'

    // Priority 1: Failures & Returns (Action Required)
    if (s.includes('returned') || s.includes('customer_return_delivered')) return 'Customer Return Delivered'
    if (s.includes('shipped_back_success') || s.includes('returned_delivered')) return 'Returned Delivered'
    if (s.includes('customer_return')) return 'Customer Return'
    // Failed Delivery basically means it's coming back, so we map it to Returning to Seller if user wants no specific "Delivery Failed" status
    if (s.includes('returning_to_seller') || s.includes('returning to seller') || s.includes('shipped_back') ||
        s.includes('failed_delivery') || s.includes('failed_delivered') || s.includes('delivery_failed') ||
        s.includes('delivery failed') || s.includes('failed')) return 'Returning to Seller'

    // Priority 3: Success Flow (Most Advanced State) - Check these FIRST to capture active movement
    if (s.includes('delivered') || s.includes('completed')) return 'Delivered'
    if (s.includes('shipped')) return 'Shipped'
    if (s.includes('ready_to_ship') || s.includes('ready to ship')) return 'Ready to Ship'
    if (s.includes('packed')) return 'Packed'

    // Priority 4: Pending (If any item is pending, the order is still active, even if some items are cancelled)
    if (s.includes('pending')) return 'Pending'

    // Priority 2: Cancellation (Only if NO success/pending/failure status exists)
    if (s.includes('canceled') || s.includes('cancelled')) return 'Cancel'

    return 'Pending'
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('storeId')

    if (!storeId) {
        return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        return NextResponse.json({ error: 'Daraz API configuration missing' }, { status: 500 })
    }

    const supabase = await createAdminClient()

    // 1. Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .single()

    if (dbError || !tokenData) {
        return NextResponse.json({ error: 'No active connection found for this store. Please connect first.' }, { status: 401 })
    }

    // Check if we just want to load local data
    const source = searchParams.get('source')
    if (source === 'db') {
        const { data: localOrders, error: localError } = await supabase
            .from('daraz_orders')
            .select('*')
            .eq('store_id', storeId)
            .order('daraz_created_at', { ascending: false })

        if (localError) {
            return NextResponse.json({ error: 'Failed to fetch local orders', details: localError }, { status: 500 })
        }
        return NextResponse.json({ orders: localOrders || [], count: localOrders?.length || 0 })
    }

    try {
        const statusParam = searchParams.get('status')

        // 2. Prepare Base Params
        // Default to last 7 days for "All" sync to keep it light.
        // For specific status sync (Pending/Shipped), use longer window (e.g., 60 days) to catch stuck/old active orders.
        const createdAfter = new Date()
        if (statusParam && statusParam !== 'all') {
            createdAfter.setDate(createdAfter.getDate() - 60)
        } else {
            createdAfter.setDate(createdAfter.getDate() - 7)
        }

        let allOrders: any[] = []
        const API_LIMIT = 50 // Max limit per request
        let offset = 0
        let hasMore = true

        // User Request: Limit "Sync All" to ~150 orders for speed. Keep "Sync Pending/Shipped" deeper.
        const MAX_SYNC_LIMIT = (statusParam === 'pending' || statusParam === 'shipped') ? 2000 : 150

        console.log(`Starting sync for store ${storeId}. Status: ${statusParam || 'ALL'} (Limit: ${MAX_SYNC_LIMIT})`)

        // Pagination Loop
        while (hasMore) {
            const params: Record<string, any> = {
                app_key: appKey,
                access_token: tokenData.access_token,
                timestamp: new Date().getTime(),
                sign_method: 'sha256',
                created_after: createdAfter.toISOString(),
                sort_direction: 'DESC',
                limit: API_LIMIT,
                offset: offset
            }

            if (statusParam && statusParam !== 'all') {
                params.status = statusParam
            }

            const apiPath = '/orders/get'
            params.sign = signRequest(apiPath, params, appSecret)

            console.log(`Fetching Daraz orders (Offset: ${offset}, Limit: ${API_LIMIT})...`)

            const response = await axios.get(`${apiUrl}${apiPath}`, { params })

            // Check for Daraz API error code (0 = success)
            if (response.data.code !== "0" && response.data.code !== 0) {
                console.error('Daraz API Error:', response.data)
                throw new Error(response.data.message || response.data.msg || 'Daraz API Error')
            }

            const batchOrders = response.data.data?.orders || []

            if (batchOrders.length > 0) {
                allOrders = [...allOrders, ...batchOrders]
            }

            // Check pagination
            if (batchOrders.length < API_LIMIT) {
                hasMore = false
            } else {
                offset += API_LIMIT

                // Enforce Sync Limit
                if (offset >= MAX_SYNC_LIMIT) {
                    console.log(`Reached sync limit of ${MAX_SYNC_LIMIT} orders. Stopping.`)
                    hasMore = false
                }

                // Safety break (absolute max)
                if (offset > 1000) {
                    hasMore = false
                }

                // Small delay between pages
                await new Promise(r => setTimeout(r, 200))
            }
        }

        console.log(`Total orders fetched: ${allOrders.length}`)

        // 2.1 Deduplicate Orders (Fix for potential API duplicates)
        const uniqueOrderMap = new Map()
        allOrders.forEach(o => uniqueOrderMap.set(String(o.order_id), o))
        const orders = Array.from(uniqueOrderMap.values())
        console.log(`Unique orders to process: ${orders.length}`)

        // 3. Enrich with Items (Concurrent Fetching with Rate Limiting)
        // Rate limits are often tight (e.g. 5 req/sec). We use chunks of 5 to speed up.
        const enrichedOrders: any[] = []
        const CHUNK_SIZE = 5

        for (let i = 0; i < allOrders.length; i += CHUNK_SIZE) {
            const chunk = allOrders.slice(i, i + CHUNK_SIZE)

            console.log(`Fetching items for chunk ${i / CHUNK_SIZE + 1} / ${Math.ceil(allOrders.length / CHUNK_SIZE)}...`)

            const chunkResults = await Promise.all(chunk.map(async (order) => {
                try {
                    const oid = order.order_id
                    const itemTimestamp = new Date().getTime()
                    const itemParams: Record<string, any> = {
                        app_key: appKey,
                        access_token: tokenData.access_token,
                        timestamp: itemTimestamp,
                        sign_method: 'sha256',
                        order_id: oid
                    }
                    itemParams.sign = signRequest('/order/items/get', itemParams, appSecret)

                    const itemRes = await axios.get(`${apiUrl}/order/items/get`, { params: itemParams })
                    const items = itemRes.data.data || []

                    return {
                        ...order,
                        store_id: storeId,
                        items_detail: items
                    }
                } catch (err: any) {
                    console.error(`Error fetching items for order ${order.order_id}`, err.message)
                    // Fail gracefully but keep order
                    return { ...order, store_id: storeId, items_detail: [] }
                }
            }))

            enrichedOrders.push(...chunkResults)

            // Small delay between chunks to be safe (200ms)
            if (i + CHUNK_SIZE < allOrders.length) {
                await new Promise(resolve => setTimeout(resolve, 200))
            }
        }

        // No need to slice/combine anymore since we try map all
        const finalOrders = enrichedOrders

        // 4. Upsert to Database (Persistence) & Auto-Sync Logic
        if (finalOrders.length > 0) {
            // A. Fetch Products for SKU matching
            const { data: products } = await supabase
                .from('products')
                .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name, seller_account')
                .limit(10000)

            // Fetch Sync Settings (Cutoff Date)
            let cutoffDate: Date | null = null
            try {
                const { data: settings, error: settingsError } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'daraz_sync_rules')
                    .single()

                if (!settingsError && settings?.value?.cutoff_date) {
                    cutoffDate = new Date(settings.value.cutoff_date)
                }
            } catch (err) {
                console.warn('Sync settings table missing or error, proceeding without cutoff:', err)
            }

            // Map for quick lookup
            const skuMap = new Map<string, any>()
            const nameMap = new Map<string, any>()

            products?.forEach(p => {
                if (p.seller_sku1) skuMap.set(p.seller_sku1.toLowerCase(), p)
                if (p.seller_sku2) skuMap.set(p.seller_sku2.toLowerCase(), p)
                if (p.seller_sku3) skuMap.set(p.seller_sku3.toLowerCase(), p)
                if (p.seller_sku4) skuMap.set(p.seller_sku4.toLowerCase(), p)
                if (p.product_name) nameMap.set(p.product_name.toLowerCase().trim(), p)
            })

            // B. Batch fetch ALL existing orders to avoid N queries in the loop
            const allOrderIds = finalOrders.map(o => String(o.order_id)).filter(Boolean)
            const allOrderNumbers = finalOrders.map(o => String(o.order_number)).filter(Boolean)

            // Split into chunks if too large (Supabase 'in' limit ~65k params, but safe side 1000)
            // For now assuming < 1000 orders in sync

            const [existingByIdResults, existingByNumberResults] = await Promise.all([
                supabase
                    .from('daraz_orders')
                    .select('id, invoice_number, order_status, order_number, order_id, import_source')
                    .in('order_id', allOrderIds),
                supabase
                    .from('daraz_orders')
                    .select('id, invoice_number, order_status, order_number, order_id, import_source')
                    .in('order_number', allOrderNumbers)
            ])

            // Create lookup maps
            const existingByIdMap = new Map<string, any>()
            const existingByNumberMap = new Map<string, any>()

            existingByIdResults.data?.forEach(order => {
                if (order.order_id) existingByIdMap.set(String(order.order_id), order)
            })

            existingByNumberResults.data?.forEach(order => {
                if (order.order_number) existingByNumberMap.set(String(order.order_number), order)
            })

            // C. Process orders - BATCH OPTIMIZED VERSION
            // Step 1: Pre-process all orders to determine what needs to be done
            const ordersToProcess: any[] = []
            const ordersToSoftDelete: any[] = []
            const ordersRequiringInvoice: any[] = []
            const excludedOrders: any[] = []

            console.log(`[DarazSync] Starting to process ${finalOrders.length} fetched orders`)

            for (const o of finalOrders) {
                const itemStatuses = o.items_detail?.map((i: any) => i.status).filter(Boolean) || []
                const orderStatuses = o.statuses || (o.status ? [o.status] : [])
                const allStatuses = Array.from(new Set([...orderStatuses, ...itemStatuses]))
                const salesStatus = getProminentStatus(allStatuses)
                const status = orderStatuses[0]?.toLowerCase() || 'pending'
                const orderId = String(o.order_id)
                const orderNumber = String(o.order_number)
                const orderDate = new Date(o.created_at)

                // Logic: Exclude Unpaid/Cancel from Sales
                const shouldBeInSales = !['unpaid', 'cancel', 'canceled', 'cancelled'].includes(status)
                const isBeforeCutoff = cutoffDate && orderDate < cutoffDate
                const effectiveShouldSync = shouldBeInSales && !isBeforeCutoff

                let existingOrderObj = existingByIdMap.get(orderId) || existingByNumberMap.get(orderNumber) || null

                if (!effectiveShouldSync) {
                    // LOG WHY ORDER IS EXCLUDED
                    const reason = !shouldBeInSales
                        ? `Status '${status}' is excluded (unpaid/cancel)`
                        : `Order date ${orderDate.toISOString()} is before cutoff ${cutoffDate?.toISOString()}`

                    console.log(`[DarazSync] ❌ EXCLUDED Order #${orderNumber} (${orderId}): ${reason}`)
                    console.log(`  - Raw statuses: ${JSON.stringify(orderStatuses)}`)
                    console.log(`  - Item statuses: ${JSON.stringify(itemStatuses)}`)
                    console.log(`  - All statuses: ${JSON.stringify(allStatuses)}`)
                    console.log(`  - Computed salesStatus: ${salesStatus}`)
                    console.log(`  - First status: ${status}`)

                    excludedOrders.push({ orderNumber, orderId, reason, status, salesStatus, orderStatuses, itemStatuses })

                    if (existingOrderObj && isBeforeCutoff && ['cancel', 'canceled', 'cancelled'].includes(status)) {
                        ordersToSoftDelete.push(existingOrderObj)
                    }
                    continue
                }

                // Prepare tracking code
                let trackingCode: string | null = null
                if (!['pending', 'unpaid', 'canceled'].includes(status)) {
                    const codes = new Set<string>()
                    if (o.tracking_code) codes.add(o.tracking_code)
                    if (o.items_detail && Array.isArray(o.items_detail)) {
                        o.items_detail.forEach((i: any) => {
                            const code = i.tracking_code || i.trackingCode || i.tracking_number || i.package_id
                            if (code) codes.add(String(code))
                        })
                    }
                    trackingCode = codes.size > 0 ? Array.from(codes).join(', ') : null
                }

                // Check if invoice is needed
                const needsInvoice = !existingOrderObj?.invoice_number && effectiveShouldSync
                if (needsInvoice) {
                    ordersRequiringInvoice.push(o)
                }

                ordersToProcess.push({
                    rawOrder: o,
                    salesStatus,
                    allStatuses,
                    status,
                    orderId,
                    existingOrderObj,
                    trackingCode,
                    needsInvoice,
                    effectiveShouldSync
                })
            }

            // Log summary
            console.log(`[DarazSync] Pre-processing complete:`)
            console.log(`  ✓ Orders to process: ${ordersToProcess.length}`)
            console.log(`  ✓ Orders requiring invoice: ${ordersRequiringInvoice.length}`)
            console.log(`  ✓ Orders to soft-delete: ${ordersToSoftDelete.length}`)
            console.log(`  ❌ Orders excluded: ${excludedOrders.length}`)
            if (excludedOrders.length > 0) {
                console.log(`  Excluded order numbers: ${excludedOrders.map(o => o.orderNumber).join(', ')}`)
            }


            // Step 2: Batch soft delete cancelled orders
            if (ordersToSoftDelete.length > 0) {
                console.log(`[DarazSync] Soft deleting ${ordersToSoftDelete.length} cancelled orders`)
                const idsToDelete = ordersToSoftDelete.map(o => o.id)
                await supabase.from('daraz_orders')
                    .update({ deleted: true })
                    .in('id', idsToDelete)
            }

            // Step 3: Batch generate invoice numbers
            const invoiceMap = new Map<string, string>()
            if (ordersRequiringInvoice.length > 0) {
                console.log(`[DarazSync] Generating ${ordersRequiringInvoice.length} invoice numbers`)
                const { data: baseInvData, error: invErr } = await supabase.rpc('generate_daraz_invoice_number')
                
                if (!invErr && baseInvData) {
                    const match = baseInvData.match(/(.*- )(\d+)$/);
                    if (match && match.length === 3) {
                        const prefix = match[1];
                        let startingNum = parseInt(match[2], 10);
                        
                        for (let i = 0; i < ordersRequiringInvoice.length; i++) {
                            const order = ordersRequiringInvoice[i];
                            const currentInv = `${prefix}${startingNum + i}`;
                            invoiceMap.set(String(order.order_id), currentInv);
                        }
                    } else {
                        // Fallback if regex doesn't match
                        for (let i = 0; i < ordersRequiringInvoice.length; i++) {
                            const order = ordersRequiringInvoice[i];
                            invoiceMap.set(String(order.order_id), i === 0 ? baseInvData : `${baseInvData}-${i}`);
                        }
                    }
                }
            }

            // Step 4: Prepare batch updates and inserts
            const ordersToUpdate: any[] = []
            const ordersToInsert: any[] = []
            const orderIdToProcessedMap = new Map<string, any>()

            for (const processedOrder of ordersToProcess) {
                const { rawOrder: o, salesStatus, allStatuses, orderId, existingOrderObj, trackingCode, needsInvoice } = processedOrder

                const shipping = typeof o.address_shipping === 'string' ? JSON.parse(o.address_shipping || '{}') : o.address_shipping || {}
                const billing = typeof o.address_billing === 'string' ? JSON.parse(o.address_billing || '{}') : o.address_billing || {}
                const shippingPhone = shipping.phone || shipping.Phone || null

                const invoiceNumber = existingOrderObj?.invoice_number || (needsInvoice ? invoiceMap.get(orderId) : null)

                // Common Payload
                const eventTime = o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()
                const commonPayload: any = {
                    order_status: salesStatus,
                    statuses: allStatuses,
                    daraz_updated_at: o.updated_at,
                    synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    deleted: false,
                    import_source: 'api_sync',
                    tracking_code: trackingCode,
                    tracking_number: trackingCode,
                    shipped_by: null, delivered_by: null, failed_delivered_by: null, customer_returned_by: null, edit_by: null,
                    edited_at: eventTime
                }

                // Timestamps mapping
                if (salesStatus === 'Shipped') commonPayload.shipped_at = eventTime
                if (salesStatus === 'Delivered') commonPayload.delivered_at = eventTime
                if (salesStatus === 'Failed Delivered') commonPayload.failed_delivered_at = eventTime
                if (salesStatus === 'Delivery Failed') commonPayload.delivery_failed_at = eventTime
                if (salesStatus === 'Customer Return') commonPayload.customer_return_at = eventTime
                if (salesStatus === 'Returning To Seller') commonPayload.returning_to_seller_at = eventTime
                if (salesStatus === 'Customer Return Delivered') commonPayload.customer_return_delivered_at = eventTime
                if (salesStatus === 'Cancel' || salesStatus === 'Cancelled') commonPayload.cancelled_at = eventTime

                // Capture official Daraz delivery timestamp
                if (salesStatus === 'Delivered') {
                    commonPayload.delivered_by_daraz = o.updated_at ? new Date(o.updated_at).toISOString() : eventTime
                }

                if (existingOrderObj) {
                    const updatePayload = {
                        ...commonPayload,
                        invoice_number: invoiceNumber,
                        order_id: String(o.order_id),
                        store_id: storeId
                    }
                    if (existingOrderObj.import_source === 'manual' || existingOrderObj.import_source === 'csv') {
                        delete (updatePayload as any).import_source
                    }
                    ordersToUpdate.push({ id: existingOrderObj.id, payload: updatePayload })
                    orderIdToProcessedMap.set(orderId, { ...existingOrderObj, ...updatePayload, items_detail: o.items_detail })
                } else {
                    const insertPayload = {
                        ...commonPayload,
                        order_id: String(o.order_id),
                        order_number: String(o.order_number),
                        store_id: storeId,
                        customer_first_name: o.customer_first_name,
                        customer_last_name: o.customer_last_name,
                        shipping_name: shipping.first_name || shipping.firstName || shipping.name || o.customer_first_name || 'N/A',
                        shipping_address: shipping.address1 || shipping.address2 || billing.address1 || '',
                        shipping_city: shipping.city || shipping.City,
                        shipping_postcode: shipping.post_code || shipping.postCode || shipping.PostCode,
                        shipping_phone: shippingPhone,
                        invoice_number: invoiceNumber,
                        customer_name: shipping.first_name || shipping.firstName || shipping.name || o.customer_name || o.customer_first_name || 'Guest',
                        price: o.price,
                        items_count: o.items_count,
                        daraz_created_at: o.created_at,
                        order_date: o.created_at,
                        order_source: 'sync'
                    }
                    ordersToInsert.push({ orderId, payload: insertPayload, items_detail: o.items_detail })
                }
            }

            // Step 5: Execute batch updates
            if (ordersToUpdate.length > 0) {
                console.log(`[DarazSync] Batch updating ${ordersToUpdate.length} existing orders`)
                for (const { id, payload } of ordersToUpdate) {
                    const { error } = await supabase.from('daraz_orders').update(payload).eq('id', id)
                    if (error) console.error(`[DarazSync] Update failed for order id ${id}:`, error)
                }
            }

            // Step 6: Execute batch inserts using upsert
            let insertedOrders: any[] = []
            if (ordersToInsert.length > 0) {
                console.log(`[DarazSync] Batch inserting ${ordersToInsert.length} new orders`)
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .upsert(ordersToInsert.map(o => o.payload), { onConflict: 'order_id' })
                    .select()

                if (error) {
                    console.error('[DarazSync] Batch insert failed:', error)

                    // If batch insert failed due to invoice number conflict, try individual inserts
                    if (error.code === '23505' && error.message.includes('invoice_number_key')) {
                        console.log('[DarazSync] Falling back to individual inserts with invoice regeneration...')

                        for (const orderToInsert of ordersToInsert) {
                            let attempt = 0
                            let inserted = false

                            while (attempt < 4 && !inserted) {
                                try {
                                    // If invoice conflict, manually increment the invoice string or append random suffix
                                    // Bypasses Next.js fetch caching which repeats identical RPC data
                                    if (attempt > 0) {
                                        const currentInv = orderToInsert.payload.invoice_number;
                                        if (currentInv) {
                                            const match = currentInv.match(/(.*- )(\d+)$/);
                                            if (match && match.length === 3) {
                                                 const prefix = match[1];
                                                 const num = parseInt(match[2], 10);
                                                 const newInvoiceStr = `${prefix}${num + attempt}`;
                                                 orderToInsert.payload.invoice_number = newInvoiceStr;
                                                 console.log(`[DarazSync] Regenerated sequence invoice for order ${orderToInsert.payload.order_number}: ${newInvoiceStr}`);
                                            } else {
                                                 const randAppendix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                                 orderToInsert.payload.invoice_number = `${currentInv}-${randAppendix}`;
                                                 console.log(`[DarazSync] Appended random suffix for order ${orderToInsert.payload.order_number}`);
                                            }
                                        }
                                    }

                                    const { data: singleInsert, error: singleError } = await supabase
                                        .from('daraz_orders')
                                        .upsert(orderToInsert.payload, { onConflict: 'order_id' })
                                        .select()
                                        .single()

                                    if (singleError) {
                                        if (singleError.code === '23505' && singleError.message.includes('invoice_number_key')) {
                                            console.log(`[DarazSync] Invoice conflict on attempt ${attempt + 1} for order ${orderToInsert.payload.order_number}, retrying...`)
                                            attempt++
                                            continue
                                        } else {
                                            console.error(`[DarazSync] Failed to insert order ${orderToInsert.payload.order_number}:`, singleError)
                                            break
                                        }
                                    }

                                    if (singleInsert) {
                                        insertedOrders.push(singleInsert)
                                        orderIdToProcessedMap.set(orderToInsert.orderId, { ...singleInsert, items_detail: orderToInsert.items_detail })
                                        inserted = true
                                        console.log(`[DarazSync] ✓ Successfully inserted order ${orderToInsert.payload.order_number}`)
                                    }
                                } catch (err) {
                                    console.error(`[DarazSync] Exception inserting order ${orderToInsert.payload.order_number}:`, err)
                                    break
                                }
                            }

                            if (!inserted) {
                                console.error(`[DarazSync] ❌ Failed to insert order ${orderToInsert.payload.order_number} after ${attempt} attempts`)
                            }
                        }
                    }
                } else {
                    insertedOrders = data || []
                    // Map inserted orders back
                    insertedOrders.forEach((insertedOrder) => {
                        const matchingOrder = ordersToInsert.find(o => o.payload.order_id === insertedOrder.order_id)
                        if (matchingOrder) {
                            orderIdToProcessedMap.set(matchingOrder.orderId, { ...insertedOrder, items_detail: matchingOrder.items_detail })
                        }
                    })
                }
            }

            // Step 7: Batch process items
            // First, collect all order IDs that need item deletion
            const orderIdsForItemDeletion = Array.from(orderIdToProcessedMap.values())
                .filter(order => {
                    const items = order.items_detail || []
                    const itemsToSync = items.filter((item: any) => !['unpaid', 'canceled', 'cancelled'].includes((item.status || '').toLowerCase()))
                    return itemsToSync.length > 0
                })
                .map(order => order.id)
                .filter(Boolean)

            // Batch delete all items for orders that need re-syncing
            if (orderIdsForItemDeletion.length > 0) {
                console.log(`[DarazSync] Batch deleting items for ${orderIdsForItemDeletion.length} orders`)
                await supabase.from('daraz_order_items').delete().in('order_id', orderIdsForItemDeletion)
            }

            // Prepare all items for batch insert
            const allItemsToInsert: any[] = []
            const ordersNeedingFinanceSync: string[] = []

            for (const savedOrder of orderIdToProcessedMap.values()) {
                if (!savedOrder.id) continue

                const allItems = savedOrder.items_detail || []
                const itemsToSync = allItems.filter((item: any) => !['unpaid', 'canceled', 'cancelled'].includes((item.status || '').toLowerCase()))

                if (itemsToSync.length > 0) {
                    let sequence = 1
                    for (const item of itemsToSync) {
                        const shopSku = item.shop_sku || item.ShopSku || ''
                        const sku = item.sku || item.Sku || ''
                        const itemStatus = item.status || 'pending'
                        const itemName = (item.name || '').toLowerCase().trim()

                        let matchedProduct = skuMap.get(sku.toLowerCase()) || skuMap.get(shopSku.toLowerCase())
                        if (!matchedProduct && itemName) matchedProduct = nameMap.get(itemName)

                        allItemsToInsert.push({
                            order_id: savedOrder.id,
                            seller_sku: sku || shopSku,
                            product_id: matchedProduct?.id || null,
                            product_name: matchedProduct?.product_name || item.name || 'Unknown Product',
                            seller_account: matchedProduct?.seller_account || 'Unknown',
                            quantity: 1,
                            amount: item.item_price || item.price || 0,
                            status: itemStatus,
                            item_status: itemStatus, // Add item_status here
                            item_sequence: sequence++,
                            // INCLUDE STATUS IN KEY to functionality separate partial returns
                            aggregation_key: `${savedOrder.id}_${sku || shopSku}_${item.item_price || item.price || 0}_${itemStatus}`
                        })
                    }
                }

                // Track orders needing finance sync
                if (savedOrder.order_status === 'Delivered') {
                    ordersNeedingFinanceSync.push(savedOrder.order_number)
                }
            }

            // Aggregate items by order and SKU+price
            if (allItemsToInsert.length > 0) {
                console.log(`[DarazSync] Batch inserting ${allItemsToInsert.length} items across all orders`)
                const aggregatedItems = new Map<string, any>()
                allItemsToInsert.forEach(item => {
                    const key = item.aggregation_key
                    if (aggregatedItems.has(key)) {
                        aggregatedItems.get(key).quantity += 1
                    } else {
                        const { aggregation_key, ...itemWithoutKey } = item
                        aggregatedItems.set(key, itemWithoutKey)
                    }
                })

                const finalItems = Array.from(aggregatedItems.values())
                if (finalItems.length > 0) {
                    const { error: itemsError } = await supabase.from('daraz_order_items').insert(finalItems)
                    if (itemsError) console.error('[DarazSync] Batch items insert failed:', itemsError)
                }
            }

            // Step 8: Auto-sync finance for delivered orders (can be done async if needed)
            if (ordersNeedingFinanceSync.length > 0) {
                console.log(`[DarazSync] Syncing finance for ${ordersNeedingFinanceSync.length} delivered orders`)
                for (const orderNumber of ordersNeedingFinanceSync) {
                    try {
                        await syncOrderPurchaseCost(orderNumber)
                    } catch (e) {
                        console.error(`Auto-sync finance failed for ${orderNumber}`, e)
                    }
                }
            }
        }

        // Return Statement Correction
        return NextResponse.json({ orders: finalOrders, count: allOrders.length })

    } catch (error: any) {
        console.error('Order Fetch Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Failed to fetch orders from Daraz',
            details: error.response?.data || error.message
        }, { status: 500 })
    }
}
