import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getEcommerceSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL
    const key = process.env.ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_ANON_KEY
    if (!url || !key) {
        throw new Error('Ecommerce Supabase configuration is missing in environment variables')
    }
    return createSupabaseClient(url, key)
}

function stripHtml(html: string | null): string {
    if (!html) return 'No description provided.'
    let text = html
        .replace(/<\/li>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
    text = text.replace(/<[^>]*>/g, '')
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
}

function parseHighlights(html: string | null): string[] {
    if (!html) return ['Quality Guaranteed']
    const match = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi)
    if (match) {
        return match.map(m => m.replace(/<[^>]*>/g, '').trim()).filter(Boolean)
    }
    return html
        .split('\n')
        .map(line => line.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
}

export async function GET(request: NextRequest) {
    const startTime = Date.now()

    try {
        const warehouseSupabase = await createAdminClient()
        const ecommerceSupabase = getEcommerceSupabaseClient()
        console.log('[Cron-Push] Starting automatic product sync to ecommerce storefront...')

        // 1. Fetch all products that are approved, pending website sync, and have a resolved website category and seller SKU
        const { data: products, error } = await warehouseSupabase
            .from('products')
            .select('*')
            .eq('approval_status', 'Approved')
            .eq('website_sync_status', 'Pending')
            .not('website_category', 'is', null)
            .neq('website_category', '')
            .neq('website_category', 'Select Category')
            .neq('website_category', 'Unmapped')
            .not('seller_sku1', 'is', null)
            .neq('seller_sku1', '')

        if (error) {
            throw new Error(`Failed to fetch pending approved products: ${error.message}`)
        }

        // Additional client-side validation to ensure we only push products with a valid category AND a seller SKU
        const eligibleProducts = (products || []).filter(product => {
            const cat = product.website_category
            const hasCategory = cat && cat.trim() !== '' && cat !== 'Select Category' && cat !== 'Unmapped'
            const hasSku = product.seller_sku1 && product.seller_sku1.trim() !== ''
            return hasCategory && hasSku
        })

        console.log(`[Cron-Push] Found ${eligibleProducts.length} products eligible for automatic push.`)

        const pushedProducts = []
        const failedProducts = []

        if (eligibleProducts.length > 0) {
            for (const product of eligibleProducts) {
                try {
                    const displayName = product.product_title || product.product_name || 'Store Product'
                    
                    // Generate unique URL slug
                    const slug = displayName
                        .toLowerCase()
                        .replace(/ /g, '-')
                        .replace(/[^\w-]+/g, '') + '-' + Math.random().toString(36).substring(2, 5)

                    // Build image list
                    const imageList: string[] = []
                    if (product.image_url) imageList.push(product.image_url)
                    if (Array.isArray(product.other_images)) {
                        imageList.push(...product.other_images)
                    }

                    // Parse highlights
                    const parsedHighlights = product.highlights 
                        ? parseHighlights(product.highlights)
                        : ['Quality Guaranteed']

                    const payload = {
                        inventory_id: product.id,
                        warehouse_product_id: String(product.product_id),
                        display_name: displayName,
                        description: stripHtml(product.description),
                        regular_price: product.regular_price || 0,
                        special_price: product.special_price || null,
                        stock_quantity: 100, // Default stock qty
                        category: product.website_category,
                        sub_category: null, // Sub Category is optional
                        brand: 'No Brand',
                        images: imageList,
                        highlights: parsedHighlights,
                        slug: slug,
                        status: 'active',
                        price: product.regular_price || 0,
                        rating: 0,
                        reviews_count: 0,
                        created_at: new Date().toISOString()
                    }

                    // Insert to ecommerce storefront table
                    const { error: insertError } = await ecommerceSupabase
                        .from('ecommerce_products')
                        .insert(payload)

                    if (insertError) {
                        throw new Error(`Storefront insert failed: ${insertError.message}`)
                    }

                    // Update warehouse sync status
                    const { error: updateError } = await warehouseSupabase
                        .from('products')
                        .update({
                            website_sync_status: 'Done',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', product.id)

                    if (updateError) {
                        throw new Error(`Warehouse status update failed: ${updateError.message}`)
                    }

                    pushedProducts.push({
                        id: product.id,
                        product_name: displayName,
                        category: product.website_category
                    })

                } catch (prodError: any) {
                    console.error(`[Cron-Push] Error pushing product ${product.product_name}:`, prodError.message)
                    failedProducts.push({
                        id: product.id,
                        product_name: product.product_name,
                        error: prodError.message
                    })
                }
            }
        }

        if (pushedProducts.length > 0) {
            revalidatePath('/dashboard/inventory/product-list')
        }

        return NextResponse.json({
            success: true,
            total_eligible: eligibleProducts.length,
            pushed_count: pushedProducts.length,
            pushed_items: pushedProducts,
            failed_count: failedProducts.length,
            failed_items: failedProducts,
            elapsed_ms: Date.now() - startTime
        })

    } catch (err: any) {
        console.error('[Cron-Push] Critical error in push website cron:', err.message)
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    return GET(request)
}
