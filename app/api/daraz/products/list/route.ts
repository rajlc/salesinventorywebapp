import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/daraz/products/list?status=active&store_id=xxx&offset=0&limit=50
// Fetches live products from Daraz and cross-references with internal inventory

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'all'    // all|active|inactive|live|inactive|deleted
    const storeId = searchParams.get('store_id') || ''
    const offset = parseInt(searchParams.get('offset') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    try {
        const supabase = await createAdminClient()

        // Get stores to translate storeId to seller_account name
        let storeQuery = supabase
            .from('online_stores')
            .select('id, seller_account, seller_id')
            .eq('is_active', true)

        if (storeId) {
            storeQuery = storeQuery.eq('id', storeId)
        }

        const { data: stores } = await storeQuery
        const storeNames = stores?.map(s => s.seller_account) || []

        // Start builder on local products table
        let dbQuery = supabase
            .from('products')
            .select('*', { count: 'exact' })

        // 1. Exclude deleted products by default unless viewing deleted tab
        if (status === 'deleted') {
            dbQuery = dbQuery.eq('is_deleted', true)
        } else {
            dbQuery = dbQuery.eq('is_deleted', false)
        }

        // 2. Filter only Daraz products (where at least one seller account is connected)
        if (storeId && stores && stores.length > 0) {
            const accName = stores[0].seller_account
            dbQuery = dbQuery.or(`seller_account1.eq."${accName}",seller_account2.eq."${accName}",seller_account3.eq."${accName}",seller_account4.eq."${accName}"`)
        } else {
            // All active Daraz accounts
            dbQuery = dbQuery.or('seller_account1.not.is.null,seller_account2.not.is.null,seller_account3.not.is.null,seller_account4.not.is.null')
        }

        // 3. Search filter
        if (search) {
            dbQuery = dbQuery.ilike('product_name', `%${search}%`)
        }

        // 4. Status Filter Mapping
        if (status !== 'all' && status !== 'deleted') {
            if (status === 'active') {
                dbQuery = dbQuery.or('status.ilike.active,status.ilike.live')
            } else if (status === 'inactive') {
                dbQuery = dbQuery.or('status.ilike.inactive,status.ilike.offline')
            } else if (status === 'draft') {
                dbQuery = dbQuery.ilike('status', 'draft')
            } else if (status === 'pending_qc') {
                dbQuery = dbQuery.ilike('status', 'pending')
            }
        }

        // Apply pagination
        dbQuery = dbQuery
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data: dbProducts, count: totalCount, error: dbErr } = await dbQuery
        if (dbErr) throw new Error(dbErr.message)

        // Convert db records to UI products list schema format
        const formatted = (dbProducts || []).map(p => {
            // Find which account is set
            const sellerAccount = p.seller_account1 || p.seller_account2 || p.seller_account3 || p.seller_account4 || 'Unknown'
            const sellerSku = p.seller_sku1 || p.seller_sku2 || p.seller_sku3 || p.seller_sku4 || ''
            
            return {
                item_id: p.id,
                name: p.product_name || '',
                primaryCategory: p.category_name || '',
                status: p.status || 'Active',
                images: p.image_url ? [p.image_url] : (p.other_images || []),
                created_time: p.created_at,
                updated_time: p.updated_at,
                attributes: {
                    name: p.product_name || '',
                    description: p.description || '',
                    short_description: p.highlights || '',
                },
                skus: [{
                    SellerSku: sellerSku,
                    price: p.regular_price || 0,
                    special_price: p.special_price || undefined,
                    quantity: p.quantity || 0,
                    package_weight: p.weight || 0.1,
                    inventoryProductId: p.id,
                    inventoryProductName: p.product_name
                }],
                sellerAccount,
                storeId: stores?.find(s => s.seller_account === sellerAccount)?.id || storeId
            }
        })

        return NextResponse.json({
            success: true,
            products: formatted,
            total: totalCount || formatted.length
        })

    } catch (error: any) {
        console.error('[DarazProductList] DB query error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
