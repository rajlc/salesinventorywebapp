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

export async function GET(req: NextRequest) {
    if (!await validateApiKey(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = await createAdminClient()

        const searchParams = req.nextUrl.searchParams
        const search = searchParams.get('search')

        console.log(`[Inventory API] Search request received. Param: "${search}"`);

        let query = supabase
            .from('products')
            .select('id, product_name, image_url, est_price, product_type, product_id')
            .eq('is_deleted', false)
            .eq('status', 'Active')
            .order('product_name', { ascending: true })

        if (search) {
            // Only search product_name to avoid type errors with numeric product_id
            query = query.ilike('product_name', `%${search}%`)
        }

        const { data: products, error } = await query.limit(3000)

        if (error) {
            console.error('Inventory DB Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(products)

    } catch (error: any) {
        console.error('Inventory API Exception:', error);
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
