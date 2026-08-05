import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/daraz/drafts — fetch all draft listings
export async function GET() {
    try {
        const supabase = await createAdminClient()
        const { data, error } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return NextResponse.json({ success: true, data: data || [] })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST /api/daraz/drafts — create a new draft
// Body: { raw_name, images?, target_stores?, price?, supplier_id?, wholesale_price? }
export async function POST(req: NextRequest) {
    try {
        const supabase = await createAdminClient()
        const body = await req.json()

        const { data, error } = await supabase
            .from('daraz_draft_listings')
            .insert({
                raw_name: body.raw_name,
                images: body.images || [],
                target_stores: body.target_stores || [],
                price: body.price || null,
                special_price: body.special_price || null,
                supplier_id: body.supplier_id || null,
                wholesale_price: body.wholesale_price || null,
                status: 'draft'
            })
            .select('id, raw_name, status, supplier_id, wholesale_price, created_at')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// PATCH /api/daraz/drafts — update a draft by id (bulk-compatible)
// Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createAdminClient()
        const body = await req.json()
        const { id, ...fields } = body

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        const { data, error } = await supabase
            .from('daraz_draft_listings')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('id, status')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE /api/daraz/drafts?id=xxx — delete a draft
export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createAdminClient()
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        const { error } = await supabase
            .from('daraz_draft_listings')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
