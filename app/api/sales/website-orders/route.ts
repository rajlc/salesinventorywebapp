import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Validation middleware
async function validateApiKey(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false
    }
    const apiKey = authHeader.split(' ')[1]
    return apiKey === process.env.MESSENGER_APP_API_KEY
}

// Helper to generate sales ID
async function generateSalesId(supabase: any, orderDate?: string) {
    const { data, error } = await supabase
        .rpc('generate_website_sales_id', {
            for_date: orderDate || new Date().toISOString().split('T')[0]
        })

    if (error) {
        console.error('Error generating sales ID:', error)
        const date = new Date(orderDate || Date.now())
        const prefix = 'WS-' + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 90000) + 10001
        return `${prefix}-${random}`
    }

    return data
}

export async function POST(req: NextRequest) {
    // 1. Validate API Key
    if (!await validateApiKey(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        console.log('Received payload for website orders:', JSON.stringify(body, null, 2))

        const {
            order_number,
            customer_name,
            phone_number,
            alternative_phone,
            address,
            items,
            total_amount,
            delivery_charge,
            order_status,
            // Synced fields
            platform,
            page_name,
            logistic_name,
            courier_provider,
            courier_consignment_id,
            city,
            delivery_branch,
            branch_charge,
            messaging_app_order_id,
            confirmed_at,
            confirmed_by
        } = body

        const supabase = await createAdminClient()

        // 2. Generate Sales ID
        const salesId = await generateSalesId(supabase)

        // 3. Determine branch and branch charge based on courier provider
        let branchValue = null
        let branchChargeValue = branch_charge || 0

        if (courier_provider === 'pathao') {
            branchValue = city
        } else if (courier_provider === 'local') {
            branchValue = delivery_branch
        }

        // 4. Validate and format phone numbers
        const formattedPhoneNumber = phone_number?.replace(/\D/g, '').slice(0, 10) || ''
        const formattedAltPhone = alternative_phone?.replace(/\D/g, '').slice(0, 10) || null

        // 5. Create or Update Order
        let order = null
        let orderError = null

        // Check if an order with this messaging_app_order_id already exists
        const { data: existingOrder } = await supabase
            .from('website_orders')
            .select('id, sales_id')
            .eq('messaging_app_order_id', messaging_app_order_id)
            .maybeSingle();

        if (existingOrder) {
            // Update existing order
            const { data, error } = await supabase
                .from('website_orders')
                .update({
                    customer_name,
                    phone_number: formattedPhoneNumber,
                    alternative_phone: formattedAltPhone,
                    address,
                    delivery_branch: branchValue,
                    branch_charge: branchChargeValue,
                    delivery_charge: delivery_charge || 0,
                    total_amount: total_amount || 0,
                    order_status: order_status || 'Pending',
                    remarks: `Synced from Messenger App (Order #${order_number})`,
                    platform,
                    page_name,
                    logistic_name,
                    courier_provider,
                    courier_consignment_id,
                    city,
                    confirmed_at,
                    confirmed_by
                })
                .eq('id', existingOrder.id)
                .select()
                .single();
            order = data;
            orderError = error;

            // Delete existing items for this order first
            if (!orderError) {
                await supabase
                    .from('website_order_items')
                    .delete()
                    .eq('order_id', existingOrder.id);
            }
        } else {
            // Create Order
            const { data, error } = await supabase
                .from('website_orders')
                .insert({
                    sales_id: salesId,
                    order_date: new Date().toISOString().split('T')[0],
                    customer_name,
                    phone_number: formattedPhoneNumber,
                    alternative_phone: formattedAltPhone,
                    address,
                    delivery_branch: branchValue,
                    branch_charge: branchChargeValue,
                    delivery_charge: delivery_charge || 0,
                    total_amount: total_amount || 0,
                    order_status: order_status || 'Pending',
                    user_type: 'System',
                    order_type: 'Website',
                    remarks: `Synced from Messenger App (Order #${order_number})`,
                    platform,
                    page_name,
                    logistic_name,
                    courier_provider,
                    courier_consignment_id,
                    city,
                    messaging_app_order_id,
                    confirmed_at,
                    confirmed_by
                })
                .select()
                .single();
            order = data;
            orderError = error;
        }

        if (orderError) {
            console.error('Order creation/update error:', orderError)
            return NextResponse.json({ 
                error: orderError.message,
                details: 'Failed to save website order'
            }, { status: 500 })
        }

        // 6. Create Items
        if (items && items.length > 0) {
            const itemsToInsert = await Promise.all(items.map(async (item: any) => {
                let resolvedProductId = null;
                const pid = item.product_id;
                const pName = item.product_name || item.name;

                // 1. Check if product_id is a valid UUID
                if (pid && typeof pid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pid)) {
                    const { data: pByUuid } = await supabase
                        .from('products')
                        .select('id')
                        .eq('id', pid)
                        .eq('is_deleted', false)
                        .maybeSingle();
                    if (pByUuid) {
                        resolvedProductId = pByUuid.id;
                    }
                }

                // 2. If not resolved yet, check if product_id matches the SKU/numeric product_id field in products
                if (!resolvedProductId && pid) {
                    const { data: pBySku } = await supabase
                        .from('products')
                        .select('id')
                        .eq('product_id', pid.toString())
                        .eq('is_deleted', false)
                        .maybeSingle();
                    if (pBySku) {
                        resolvedProductId = pBySku.id;
                    }
                }

                // 3. If still not resolved, lookup by exact product_name
                if (!resolvedProductId && pName) {
                    const { data: pByName } = await supabase
                        .from('products')
                        .select('id')
                        .eq('product_name', pName)
                        .eq('is_deleted', false)
                        .maybeSingle();
                    if (pByName) {
                        resolvedProductId = pByName.id;
                    }
                }

                return {
                    order_id: order.id,
                    product_id: resolvedProductId,
                    product_name: pName,
                    quantity: item.quantity,
                    amount: item.price || 0
                };
            }));

            const { error: itemsError } = await supabase
                .from('website_order_items')
                .insert(itemsToInsert)

            if (itemsError) {
                console.error('Items creation error:', itemsError)
                return NextResponse.json({ error: 'Order created but items failed: ' + itemsError.message }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            data: order,
            message: 'Website order created successfully'
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
