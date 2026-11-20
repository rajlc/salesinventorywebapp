import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
    getRequestListingScope,
    filterVisibleDrafts,
    isDraftVisible,
    mergeTargetStoresForScope
} from '@/lib/daraz/listing-access'

const unauthorized = () => NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
const readOnly = () => NextResponse.json({ error: 'You have view-only access to Daraz Listing' }, { status: 403 })

// GET /api/daraz/drafts — fetch draft listings (restricted staff only see drafts of their allowed stores)
export async function GET() {
    try {
        const scope = await getRequestListingScope()
        if (!scope.userId) return unauthorized()

        const supabase = await createAdminClient()
        const { data, error } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        const normalized = filterVisibleDrafts(scope, data || []).map((item: any) => ({
            ...item,
            product_link: item.attributes?.product_link || null,
            draft_type: item.attributes?.draft_type || null,
            mrp_price: item.attributes?.mrp_price !== undefined && item.attributes?.mrp_price !== null
                ? Number(item.attributes.mrp_price)
                : (item.mrp_price !== undefined && item.mrp_price !== null ? Number(item.mrp_price) : null),
            campaign_price: item.campaign_price !== undefined && item.campaign_price !== null
                ? Number(item.campaign_price)
                : (item.attributes?.campaign_price !== undefined && item.attributes?.campaign_price !== null ? Number(item.attributes.campaign_price) : null)
        }))

        return NextResponse.json({ success: true, data: normalized })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// Helper to compute draft_type based on provided fields
function computeDraftType(item: {
    status?: string
    raw_name?: string | null
    images?: string[]
    product_link?: string | null
    title?: string | null
    description?: string | null
    highlights?: string[] | null
    category_id?: number | null
}): 'image_only' | 'link_only' | 'name_only' | 'pending' | 'ready' | 'pushed' {
    if (item.status === 'pushed') return 'pushed'

    const hasTitle = !!item.title && item.title.trim().length > 0
    const hasDesc = !!item.description && item.description.trim().length > 0
    const hasHighlights = Array.isArray(item.highlights) && item.highlights.length > 0
    const hasCategory = !!item.category_id

    // Fully generated / ready
    if (hasTitle && hasDesc && hasHighlights && hasCategory) {
        return 'ready'
    }

    const hasImages = Array.isArray(item.images) && item.images.length > 0
    const hasLink = !!item.product_link && item.product_link.trim().length > 0
    const raw = (item.raw_name || '').trim()
    const isGenericName = !raw || raw.startsWith('[Image Only]') || raw.startsWith('[Link') || raw.startsWith('Untitled')
    const hasCustomName = !!raw && !isGenericName

    // Single source additions
    if (hasImages && !hasLink && !hasCustomName) {
        return 'image_only'
    }
    if (hasLink && !hasImages && !hasCustomName) {
        return 'link_only'
    }
    if (hasCustomName && !hasImages && !hasLink) {
        return 'name_only'
    }

    // Combination / pending completion
    return 'pending'
}

// POST /api/daraz/drafts — create a new draft
export async function POST(req: NextRequest) {
    try {
        const scope = await getRequestListingScope()
        if (!scope.userId) return unauthorized()
        if (!scope.canEdit) return readOnly()

        const supabase = await createAdminClient()
        const body = await req.json()

        // Restricted staff can only target stores inside their permission scope
        let effectiveTargetStores: string[] = Array.isArray(body.target_stores) ? body.target_stores : []
        if (scope.restricted) {
            const allowedSet = new Set(scope.allowedStoreIds)
            if (effectiveTargetStores.some(id => !allowedSet.has(id))) {
                return NextResponse.json({ error: 'You do not have permission for one of the selected seller accounts' }, { status: 403 })
            }
            if (effectiveTargetStores.length === 0 && scope.allowedStoreIds.length === 1) {
                effectiveTargetStores = [scope.allowedStoreIds[0]]
            }
        }

        const productLink = (body.product_link || body.attributes?.product_link || '').trim() || null
        const images = body.images || []
        let rawName = (body.raw_name || '').trim()

        // Smart name assignment if omitted
        if (!rawName) {
            if (images.length > 0 && !productLink) {
                const now = new Date()
                rawName = `[Image Only] - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
            } else if (productLink) {
                try {
                    const host = new URL(productLink).hostname.replace('www.', '')
                    rawName = `[Link] - ${host}`
                } catch {
                    rawName = `[Link] - Competitor Product`
                }
            } else {
                rawName = 'Untitled Draft'
            }
        }

        const draftType = body.draft_type || computeDraftType({
            status: body.status,
            raw_name: rawName,
            images,
            product_link: productLink,
            title: body.title,
            description: body.description,
            highlights: body.highlights,
            category_id: body.category_id
        })

        const campaignPrice = body.campaign_price !== undefined && body.campaign_price !== null ? Number(body.campaign_price) : null
        const mrpPrice = body.mrp_price !== undefined && body.mrp_price !== null
            ? Number(body.mrp_price)
            : (body.attributes?.mrp_price !== undefined && body.attributes?.mrp_price !== null ? Number(body.attributes.mrp_price) : null)

        const attributesPayload = {
            ...(body.attributes || {}),
            created_by: scope.userId,
            product_link: productLink,
            draft_type: draftType,
            ...(campaignPrice !== null ? { campaign_price: campaignPrice } : {}),
            ...(mrpPrice !== null ? { mrp_price: mrpPrice } : {})
        }

        const initialStatus = body.status || (draftType === 'ready' ? 'generated' : 'draft')
        const shouldScheduleAutoAi =
            initialStatus === 'draft' &&
            draftType !== 'ready' &&
            draftType !== 'pushed' &&
            (images.length > 0 || (rawName && !rawName.startsWith('[Link') && rawName !== 'Untitled Draft'))

        const insertRow: Record<string, any> = {
            raw_name: rawName,
            title: body.title || null,
            titles_per_store: body.titles_per_store || {},
            description: body.description || null,
            highlights: body.highlights || [],
            category_id: body.category_id || null,
            category_path: body.category_path || null,
            images,
            attributes: attributesPayload,
            target_stores: effectiveTargetStores,
            price: body.price || null,
            special_price: body.special_price || null,
            special_price_from: body.special_price_from || null,
            special_price_to: body.special_price_to || null,
            weight: body.weight ?? 0.1,
            pkg_length: body.pkg_length ?? 1,
            pkg_width: body.pkg_width ?? 1,
            pkg_height: body.pkg_height ?? 1,
            supplier_id: body.supplier_id || null,
            wholesale_price: body.wholesale_price || null,
            status: initialStatus,
            auto_ai_scheduled_at: shouldScheduleAutoAi
                ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
                : null,
        }

        if (campaignPrice !== null) {
            insertRow.campaign_price = campaignPrice
        }

        insertRow.created_by = scope.userId

        let { data, error } = await supabase
            .from('daraz_draft_listings')
            .insert(insertRow)
            .select('*')
            .single()

        if (error && (error.code === 'PGRST204' || error.message?.includes('created_by'))) {
            // created_by column not migrated yet - retry without it
            delete insertRow.created_by
            const retryCreator = await supabase.from('daraz_draft_listings').insert(insertRow).select('*').single()
            data = retryCreator.data
            error = retryCreator.error
        }

        if (error && (error.code === 'PGRST204' || error.message?.includes('campaign_price'))) {
            delete insertRow.campaign_price
            const retry = await supabase.from('daraz_draft_listings').insert(insertRow).select('*').single()
            data = retry.data
            error = retry.error
        }

        if (error) throw error

        const normalizedData = data ? {
            ...data,
            product_link: data.attributes?.product_link || null,
            draft_type: data.attributes?.draft_type || null,
            mrp_price: data.attributes?.mrp_price !== undefined && data.attributes?.mrp_price !== null
                ? Number(data.attributes.mrp_price)
                : (data.mrp_price !== undefined && data.mrp_price !== null ? Number(data.mrp_price) : null),
            campaign_price: data.campaign_price !== undefined && data.campaign_price !== null
                ? Number(data.campaign_price)
                : (data.attributes?.campaign_price !== undefined && data.attributes?.campaign_price !== null ? Number(data.attributes.campaign_price) : null)
        } : data

        return NextResponse.json({ success: true, data: normalizedData })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// Valid columns on the daraz_draft_listings table to prevent PGRST204 errors
const VALID_DRAFT_COLUMNS = new Set([
    'raw_name',
    'title',
    'titles_per_store',
    'description',
    'highlights',
    'category_id',
    'category_path',
    'images',
    'attributes',
    'target_stores',
    'price',
    'special_price',
    'special_price_from',
    'special_price_to',
    'weight',
    'pkg_length',
    'pkg_width',
    'pkg_height',
    'status',
    'error',
    'supplier_id',
    'auto_ai_scheduled_at',
    'auto_ai_attempts',
    'wholesale_price',
    'updated_at'
])

// PATCH /api/daraz/drafts — update a draft by id (bulk-compatible)
// Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
    try {
        const scope = await getRequestListingScope()
        if (!scope.userId) return unauthorized()
        if (!scope.canEdit) return readOnly()

        const supabase = await createAdminClient()
        const body = await req.json()
        const { id, ...fields } = body

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        // Get existing draft to recompute draft_type if relevant fields changed
        const { data: existing } = await supabase
            .from('daraz_draft_listings')
            .select('*')
            .eq('id', id)
            .single()

        if (!existing || !isDraftVisible(scope, existing)) {
            return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
        }

        if (scope.restricted && Array.isArray(fields.target_stores)) {
            const allowedSet = new Set(scope.allowedStoreIds)
            const existingTargets: string[] = Array.isArray(existing.target_stores) ? existing.target_stores : []
            const newlyAdded = fields.target_stores.filter((sid: string) => !existingTargets.includes(sid))
            if (newlyAdded.some((sid: string) => !allowedSet.has(sid))) {
                return NextResponse.json({ error: 'You do not have permission for one of the selected seller accounts' }, { status: 403 })
            }
            fields.target_stores = mergeTargetStoresForScope(scope, existingTargets, fields.target_stores)
        }

        const mergedAttributes = {
            ...(existing.attributes || {}),
            ...(fields.attributes || {})
        }

        if (fields.product_link !== undefined) {
            mergedAttributes.product_link = fields.product_link
        }

        if (fields.campaign_price !== undefined) {
            mergedAttributes.campaign_price = fields.campaign_price !== null ? Number(fields.campaign_price) : null
        }

        if (fields.mrp_price !== undefined) {
            mergedAttributes.mrp_price = fields.mrp_price !== null ? Number(fields.mrp_price) : null
        }

        const productLink = mergedAttributes.product_link || null
        const images = fields.images !== undefined ? fields.images : existing.images
        const rawName = fields.raw_name !== undefined ? fields.raw_name : existing.raw_name
        const title = fields.title !== undefined ? fields.title : existing.title
        const description = fields.description !== undefined ? fields.description : existing.description
        const highlights = fields.highlights !== undefined ? fields.highlights : existing.highlights
        const categoryId = fields.category_id !== undefined ? fields.category_id : existing.category_id
        const status = fields.status !== undefined ? fields.status : existing.status

        const draftType = fields.draft_type || computeDraftType({
            status,
            raw_name: rawName,
            images,
            product_link: productLink,
            title,
            description,
            highlights,
            category_id: categoryId
        })

        mergedAttributes.draft_type = draftType

        const updateData: Record<string, any> = {
            ...fields,
            attributes: mergedAttributes,
            updated_at: new Date().toISOString()
        }

        // Auto update status to 'generated' if ready
        if (draftType === 'ready' && updateData.status === 'draft') {
            updateData.status = 'generated'
        }

        // Filter updateData to only valid table columns to avoid PGRST204 errors
        // (fields like product_link, draft_type, campaign_price live inside attributes JSONB)
        const filteredUpdateData: Record<string, any> = {
            attributes: mergedAttributes,
            updated_at: updateData.updated_at
        }

        for (const [key, val] of Object.entries(updateData)) {
            if (VALID_DRAFT_COLUMNS.has(key)) {
                filteredUpdateData[key] = val
            }
        }

        const { data, error } = await supabase
            .from('daraz_draft_listings')
            .update(filteredUpdateData)
            .eq('id', id)
            .select('*')
            .single()

        if (error) throw error

        const normalizedData = data ? {
            ...data,
            product_link: data.attributes?.product_link || null,
            draft_type: data.attributes?.draft_type || null,
            mrp_price: data.attributes?.mrp_price !== undefined && data.attributes?.mrp_price !== null
                ? Number(data.attributes.mrp_price)
                : (data.mrp_price !== undefined && data.mrp_price !== null ? Number(data.mrp_price) : null),
            campaign_price: data.campaign_price !== undefined && data.campaign_price !== null
                ? Number(data.campaign_price)
                : (data.attributes?.campaign_price !== undefined && data.attributes?.campaign_price !== null ? Number(data.attributes.campaign_price) : null)
        } : data

        return NextResponse.json({ success: true, data: normalizedData })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE /api/daraz/drafts?id=xxx — delete a draft
export async function DELETE(req: NextRequest) {
    try {
        const scope = await getRequestListingScope()
        if (!scope.userId) return unauthorized()
        if (!scope.canEdit) return readOnly()

        const supabase = await createAdminClient()
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        if (scope.restricted) {
            const { data: existing } = await supabase
                .from('daraz_draft_listings')
                .select('*')
                .eq('id', id)
                .maybeSingle()
            if (!existing || !isDraftVisible(scope, existing)) {
                return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
            }
        }

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
