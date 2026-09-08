import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import sharp from 'sharp'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const draftId = searchParams.get('id')
    const idx = parseInt(searchParams.get('idx') || '0', 10)
    const directUrl = searchParams.get('url')

    let imageUrl = directUrl

    if (!imageUrl && draftId) {
        try {
            const supabase = await createAdminClient()
            const { data } = await supabase
                .from('daraz_draft_listings')
                .select('images')
                .eq('id', draftId)
                .single()

            if (data && Array.isArray(data.images) && data.images.length > idx) {
                imageUrl = data.images[idx]
            }
        } catch (err: any) {
            console.error('[ImageProxy] Supabase draft fetch error:', err.message)
        }
    }

    if (!imageUrl) {
        return new NextResponse('Image not found or missing "id" / "url" parameter', {
            status: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain'
            }
        })
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)

        const res = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            signal: controller.signal
        })
        clearTimeout(timeout)

        if (!res.ok) {
            return new NextResponse(`Failed to fetch upstream image: HTTP ${res.status}`, {
                status: res.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            })
        }

        const arrayBuf = await res.arrayBuffer()
        const buf = Buffer.from(arrayBuf)

        // Convert to high-quality progressive JPEG
        const optimizedBuf = await sharp(buf)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toBuffer()

        return new NextResponse(new Uint8Array(optimizedBuf), {
            status: 200,
            headers: {
                'Content-Type': 'image/jpeg',
                'Content-Length': optimizedBuf.length.toString(),
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'inline; filename="product.jpg"'
            }
        })
    } catch (err: any) {
        console.error('[ImageProxy] Processing error:', err.message)
        return new NextResponse(`Image proxy error: ${err.message}`, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        })
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        }
    })
}
