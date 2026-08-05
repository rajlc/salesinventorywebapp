import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/daraz/categories/attributes?category_id=8704
// Returns dynamic attributes for a specific Daraz category

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('category_id')

    if (!categoryId) {
        return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
    }

    try {
        const supabase = await createAdminClient()
        const { data: stores } = await supabase
            .from('online_stores')
            .select('id')
            .eq('is_active', true)
            .limit(1)

        if (!stores || stores.length === 0) {
            return NextResponse.json({ error: 'No active Daraz stores configured' }, { status: 400 })
        }

        const accessToken = await getValidAccessToken(stores[0].id, 'order')
        const params = buildSignedParams('/category/attributes/get', accessToken, {
            primary_category_id: categoryId,
            language_code: 'en_US'
        })

        const response = await axios.get(`${API_URL}/category/attributes/get`, { params })

        if (response.data?.code !== '0' && response.data?.code !== 0) {
            // Error 57 = no attributes for this category (normal for some categories)
            if (response.data?.code === '57' || response.data?.code === 57) {
                return NextResponse.json({ success: true, data: [] })
            }
            return NextResponse.json(
                { error: response.data?.message || response.data?.msg || 'Failed to fetch attributes' },
                { status: 500 }
            )
        }

        // Separate sale props (variants like color, size) from regular attributes
        const allAttributes = response.data?.data || []
        
        const EXCLUDED_SYSTEM_KEYS = new Set([
            'name', 'title', 'short_description', 'description', 
            'price', 'special_price', 'quantity', 'sellersku', 'seller_sku', 
            'package_weight', 'package_length', 'package_width', 'package_height', 
            'package_content', 'images', 'video', 'primary_category', 'warranty_type'
        ])

        const saleProps = allAttributes.filter((a: any) => a.is_sale_prop === '1' || a.is_sale_prop === 1)
        const regularAttrs = allAttributes.filter((a: any) => {
            const isSale = a.is_sale_prop === '1' || a.is_sale_prop === 1
            const isSystem = EXCLUDED_SYSTEM_KEYS.has(a.name.toLowerCase())
            return !isSale && !isSystem
        })

        return NextResponse.json({
            success: true,
            data: regularAttrs,
            saleProps: saleProps,   // For the Variants section
            all: allAttributes
        })

    } catch (error: any) {
        console.error('[DarazCategoryAttributes] Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
